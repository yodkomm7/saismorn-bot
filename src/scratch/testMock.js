const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Override lineClient so it runs in mock mode and logs to console
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'mock_channel_access_token';
process.env.LINE_CHANNEL_SECRET = 'mock_channel_secret';

const db = require('../database');
const botHandlers = require('../botHandlers');

// Clean slate: wipe test rows for the mock group/users before running
async function resetTestData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pool.query(`DELETE FROM bills WHERE group_id = 'C1234567890'`);
  await pool.query(`DELETE FROM users WHERE id IN ('U1111111111', 'U2222222222', 'U3333333333')`);
  await pool.end();
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ASSERTION PASSED: ${message}`);
  }
}

async function runMockTests() {
  console.log('=== STARTING LINE BOT MOCK TESTS ===\n');
  await resetTestData();

  // Mock Event Creators
  const createTextMessage = (userId, groupId, text) => ({
    type: 'message',
    replyToken: `reply_${Date.now()}_${Math.random()}`,
    source: {
      type: groupId.startsWith('C') ? 'group' : 'user',
      userId,
      groupId
    },
    message: {
      type: 'text',
      id: `msg_${Date.now()}`,
      text
    }
  });

  const createPostback = (userId, groupId, data) => ({
    type: 'postback',
    replyToken: `reply_${Date.now()}_${Math.random()}`,
    source: {
      type: groupId.startsWith('C') ? 'group' : 'user',
      userId,
      groupId
    },
    postback: {
      data
    }
  });

  const group1 = 'C1234567890';
  const userA = 'U1111111111'; // Somchai
  const userB = 'U2222222222'; // Somsri
  const userC = 'U3333333333'; // Somkiat

  console.log('1. Testing Bank Account Registration...');
  await botHandlers.handleEvent(createTextMessage(userA, group1, 'บันทึกบัญชี กสิกร 123-4-56789-0 สมชาย ใจดี'));
  await botHandlers.handleEvent(createTextMessage(userB, group1, 'บันทึก พร้อมเพย์ 0891234567 สมศรี ดีงาม'));
  // User C registers as well
  await botHandlers.handleEvent(createTextMessage(userC, group1, 'บันทึกบัญชี ไทยพาณิชย์ 987-6-54321-0 สมเกียรติ ยอดเยี่ยม'));

  const dbUserA = await db.getUser(userA);
  assert(dbUserA !== null, 'User A registered in database');
  assert(dbUserA.bankName === 'กสิกร', 'User A bank name registered correctly');
  assert(dbUserA.accountNumber === '123-4-56789-0', 'User A bank account registered correctly');
  
  const dbUserB = await db.getUser(userB);
  assert(dbUserB !== null, 'User B registered in database');
  assert(dbUserB.bankName === 'พร้อมเพย์', 'User B bank name registered correctly');

  console.log('\n2. Testing Accounts Display...');
  const allUsers = await db.getAllUsers();
  const testUsers = allUsers.filter(u => [userA, userB, userC].includes(u.id));
  assert(testUsers.length === 3, 'Three test users registered');

  console.log('\n3. Testing Party Creation (Multi-Payer)...');
  await botHandlers.handleEvent(createTextMessage(userA, group1, 'เริ่มเฉลี่ย ทริปภูเก็ต'));
  
  let activeBill = await db.getActiveBill(group1);
  assert(activeBill !== null, 'Active bill found for group');
  assert(activeBill.title === 'ทริปภูเก็ต', 'Active bill title is correct');
  assert(activeBill.type === 'multi', 'Active bill type is multi');
  assert(activeBill.participants.some(p => p.userId === userA), 'Creator User A auto-joined the party');

  console.log('\n4. Testing Friends Joining the Party...');
  // User B and C join via postback click
  await botHandlers.handleEvent(createPostback(userB, group1, `action=join&billId=${activeBill.id}`));
  await botHandlers.handleEvent(createPostback(userC, group1, `action=join&billId=${activeBill.id}`));

  activeBill = await db.getBill(activeBill.id);
  assert(activeBill.participants.length === 3, 'Three participants in the party now');
  assert(activeBill.participants.some(p => p.userId === userB), 'User B joined successfully');
  assert(activeBill.participants.some(p => p.userId === userC), 'User C joined successfully');

  console.log('\n5. Testing Logging Expenses...');
  // User A pays 1500 for Hotel
  await botHandlers.handleEvent(createTextMessage(userA, group1, 'จ่าย 1500 ค่าโรงแรม'));
  // User B pays 900 for Car Rental
  await botHandlers.handleEvent(createTextMessage(userB, group1, 'จ่าย 900 ค่ารถเช่า'));

  activeBill = await db.getBill(activeBill.id);
  assert(activeBill.payers.length === 2, 'Two payments registered');
  assert(activeBill.payers[0].amountPaid === 1500 && activeBill.payers[0].userId === userA, 'User A payment logged correctly');
  assert(activeBill.payers[1].amountPaid === 900 && activeBill.payers[1].userId === userB, 'User B payment logged correctly');

  console.log('\n6. Testing Settlement & Rebalancing Calculations...');
  // Trigger settlement
  await botHandlers.handleEvent(createTextMessage(userA, group1, 'สรุปยอด'));

  activeBill = await db.getBill(activeBill.id);
  assert(activeBill.status === 'settling', 'Bill status is now settling');
  assert(activeBill.totalAmount === 2400, 'Total expense is 2400');
  
  // Total = 2400. 3 people. Average = 800.
  // User A paid 1500 -> net = +700 (Creditor)
  // User B paid 900  -> net = +100 (Creditor)
  // User C paid 0    -> net = -800 (Debtor)
  // Transfers should be: 
  // User C transfers 700 to User A
  // User C transfers 100 to User B
  
  assert(activeBill.transfers.length === 2, 'Two transfer transactions generated');
  
  const transferToA = activeBill.transfers.find(t => t.toUserId === userA);
  assert(transferToA !== undefined, 'Found transfer to User A');
  assert(transferToA.fromUserId === userC, 'Transfer to User A is from User C');
  assert(transferToA.amount === 700, 'Transfer amount to User A is 700');

  const transferToB = activeBill.transfers.find(t => t.toUserId === userB);
  assert(transferToB !== undefined, 'Found transfer to User B');
  assert(transferToB.fromUserId === userC, 'Transfer to User B is from User C');
  assert(transferToB.amount === 100, 'Transfer amount to User B is 100');

  console.log('\n7. Testing Closing the Bill...');
  await botHandlers.handleEvent(createPostback(userA, group1, `action=close&billId=${activeBill.id}`));

  activeBill = await db.getBill(activeBill.id);
  assert(activeBill.status === 'closed', 'Bill status is closed');
  assert(await db.getActiveBill(group1) === null, 'No more active bills in the group');

  console.log('\n=== ALL MOCK TESTS PASSED SUCCESSFULLY! ===');
}

runMockTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

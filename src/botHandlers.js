const db = require('./database');
const line = require('./lineClient');
const receiptScanner = require('./receiptScanner');

/**
 * Helper function to format bank styling text labels
 */
function getBankLabel(bankName = '') {
  const name = bankName.toLowerCase().trim();
  if (name.includes('กสิกร') || name.includes('kbank')) return '💚 ธนาคารกสิกรไทย (KBANK)';
  if (name.includes('ไทยพาณิชย์') || name.includes('scb')) return '💜 ธนาคารไทยพาณิชย์ (SCB)';
  if (name.includes('กรุงศรี') || name.includes('krungsri') || name.includes('bay')) return '💛 ธนาคารกรุงศรีอยุธยา';
  if (name.includes('กรุงเทพ') || name.includes('bbl') || name.includes('bangkok')) return '💙 ธนาคารกรุงเทพ (BBL)';
  if (name.includes('กรุงไทย') || name.includes('ktb')) return '🩵 ธนาคารกรุงไทย (KTB)';
  if (name.includes('ทหารไทย') || name.includes('ธนชาต') || name.includes('ttb')) return '💙 ธนาคารทหารไทยธนชาต (TTB)';
  if (name.includes('พร้อมเพย์') || name.includes('promptpay') || name.includes('promtpay') || name.includes('pp')) return '🪪 พร้อมเพย์ (PromptPay)';
  if (name.includes('ออมสิน') || name.includes('gsb')) return '🩷 ธนาคารออมสิน';
  return `🏦 ${bankName}`;
}

/**
 * Main Webhook Event Router
 */
async function handleEvent(event) {
  if (event.type === 'join') {
    return handleJoinGroup(event);
  } else if (event.type === 'message') {
    if (event.message.type === 'text') {
      return handleTextMessage(event);
    } else if (event.message.type === 'image') {
      return handleImageMessage(event);
    }
  } else if (event.type === 'postback') {
    return handlePostback(event);
  }
  return null;
}

/**
 * Handle Bot Joining Group Chat
 */
async function handleJoinGroup(event) {
  const replyToken = event.replyToken;
  const greetingMsg = `สวัสดีค่ะทุกคน! 🍊✨

น้องส้มผู้ช่วยหารค่าอาหารประจำกลุ่มรายงานตัวค่ะ!

💡 ฟีเจอร์ที่น้องส้มช่วยได้:
1. 📸 **สแกนใบเสร็จ/สลิป:** ถ่ายรูปใบเสร็จส่งในกลุ่ม น้องส้มจะบันทึกยอดเงินและคนจ่ายให้อัตโนมัติ!
2. 💸 **ลงรายการค่าใช้จ่าย:** พิมพ์ "ค่าขนม 200" หรือ "จ่าย 800 ค่าเค้ก" (ระบบจะบันทึกคนส่งเป็นคนจ่ายและเข้าหารให้อัตโนมัติ!)
3. 🪪 **บันทึกเลขบัญชี:** พิมพ์ "บันทึกบัญชี [ธนาคาร] [เลขบัญชี] [ชื่อ]"
4. 📋 **เรียกดูบัญชี:** พิมพ์ "ดูบัญชี" หรือ "ตรวจบัญชี"
5. 🧮 **คิดเงินเคลียร์ยอด:** พิมพ์ "สรุปยอด" (คำนวณส่วนต่างใครรับคืน/โอนเพิ่มให้อัตโนมัติ!)

ยินดีที่ได้รู้จักทุกคนนะคะ! 😊`;

  return line.replyMessage(replyToken, {
    type: 'text',
    text: greetingMsg
  });
}

/**
 * Handle image messages (Receipt / Slip Scanning - Persona: น้องส้ม)
 */
async function handleImageMessage(event) {
  const messageId = event.message.id;
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const groupId = event.source.groupId || event.source.roomId || event.source.userId;

  const imageBuffer = await line.getMessageContent(messageId);
  if (!imageBuffer) {
    return line.replyMessage(replyToken, {
      type: 'text',
      text: 'น้องส้มดาวน์โหลดรูปไม่สำเร็จค่ะ รบกวนส่งรูปใหม่อีกครั้งนะคะ 😊'
    });
  }

  const scanResult = await receiptScanner.scanReceipt(imageBuffer, 'image/jpeg');

  if (!scanResult.success) {
    return line.replyMessage(replyToken, {
      type: 'text',
      text: scanResult.message
    });
  }

  const profile = await line.getUserProfile(userId, groupId);
  db.saveUser(userId, {
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl
  });

  let activeBill = db.getActiveBill(groupId);
  if (!activeBill) {
    activeBill = db.createBill(groupId, userId, scanResult.merchantName, 'multi');
  }

  const updatedBill = db.updateBill(activeBill.id, (b) => {
    if (!b.participants.some(p => p.userId === userId)) {
      b.participants.push({
        userId: userId,
        displayName: profile.displayName,
        share: 0,
        hasPaid: false
      });
    }
    b.payers.push({
      userId: userId,
      displayName: profile.displayName,
      amountPaid: scanResult.totalAmount,
      itemName: scanResult.merchantName,
      timestamp: Date.now()
    });
    return b;
  });

  const names = updatedBill.participants.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n');
  let total = updatedBill.payers.reduce((sum, p) => sum + p.amountPaid, 0);
  const splitAmount = Math.round((total / updatedBill.participants.length) * 100) / 100;

  const replyMsg = `✨ น้องส้มอ่านสลิป/ใบเสร็จเรียบร้อยค่ะ 🧾

👤 ผู้ชำระ: ${profile.displayName}
🏪 รายการ: ${scanResult.merchantName} (${scanResult.totalAmount.toLocaleString('th-TH')} บาท)

💵 ยอดรวมสะสมมื้อนี้: ${total.toLocaleString('th-TH')} บาท

👥 สมาชิกที่เข้าร่วม (${updatedBill.participants.length} คน):
${names}

💰 ตกคนละประมาณ: ${splitAmount.toLocaleString('th-TH')} บาท

👉 เพื่อนคนอื่นพิมพ์ "เข้าร่วม" เพื่อเข้าหาร
👉 เมื่อลงครบแล้วพิมพ์ "สรุปยอด" เพื่อคิดเงินนะคะ 😊`;

  return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
}

/**
 * Handle incoming text commands - Persona: น้องส้ม
 */
async function handleTextMessage(event) {
  let text = event.message.text.trim();
  
  text = text.replace(/^@\S+\s*/, '').trim();

  const userId = event.source.userId;
  const groupId = event.source.groupId || event.source.roomId || event.source.userId;
  const replyToken = event.replyToken;

  // 1. HELP COMMAND
  if (/^(ช่วยด้วย|วิธีใช้|help)$/i.test(text)) {
    return sendHelpMessage(replyToken);
  }

  // 2. REGISTER BANK ACCOUNT COMMAND
  if (/^(บันทึก|บันทึก\s*บัญชี|บันทึก\s*เลขบัญชี)/i.test(text)) {
    const registerRegex = /^(?:บันทึก|บันทึก\s*บัญชี|บันทึก\s*เลขบัญชี)\s+(.+)$/i;
    
    if (registerRegex.test(text)) {
      const content = text.match(registerRegex)[1].trim();
      const parts = content.split(/\s+/);

      if (parts.length >= 3) {
        const bankName = parts[0];
        const accountNumber = parts[1];
        const accountName = parts.slice(2).join(' ');

        const profile = await line.getUserProfile(userId, groupId);
        const user = db.saveUser(userId, {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          bankName,
          accountNumber,
          accountName
        });

        const bankLabel = getBankLabel(user.bankName);
        const replyMsg = `✨ บันทึกข้อมูลบัญชีเรียบร้อยค่ะ!

${bankLabel}
🔢 เลขบัญชี: ${user.accountNumber}
👤 ชื่อบัญชี: ${user.accountName}

น้องส้มบันทึกข้อมูลเรียบร้อยค่ะ สมาชิกสามารถพิมพ์ "ดูบัญชี" เพื่อเรียกดูได้ตลอดเวลานะคะ 😊`;

        return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
      } else if (parts.length === 1) {
        return line.replyMessage(replyToken, {
          type: 'text',
          text: `🏦 รับทราบธนาคาร "${parts[0]}" ค่ะ 😊\n\nรบกวนระบุเลขบัญชีและชื่อเจ้าของบัญชีเพิ่มเติมนะคะ\n\n👉 ตัวอย่าง: บันทึกบัญชี ${parts[0]} 123-4-56789-0 สมชาย`
        });
      } else if (parts.length === 2) {
        return line.replyMessage(replyToken, {
          type: 'text',
          text: `📌 ได้รับเลขบัญชี ${parts[1]} ธนาคาร ${parts[0]} แล้วค่ะ 😊\n\nรบกวนระบุชื่อเจ้าของบัญชีต่อท้ายอีกนิดนะคะ\n\n👉 ตัวอย่าง: บันทึกบัญชี ${parts[0]} ${parts[1]} สมชาย`
        });
      }
    }

    return line.replyMessage(replyToken, {
      type: 'text',
      text: '📌 รบกวนระบุข้อมูลบัญชีให้ครบถ้วนนะคะ 😊\n\nรูปแบบ: บันทึกบัญชี [ชื่อธนาคาร] [เลขบัญชี] [ชื่อเจ้าของบัญชี]\n\nตัวอย่าง:\nบันทึกบัญชี กรุงเทพ 123-4-56789-0 สมชาย'
    });
  }

  // 3. VIEW BANK ACCOUNTS COMMAND
  if (/^(ดู\s*บัญชี|ดู\s*เลขบัญชี|ตรวจ\s*บัญชี|เช็ค\s*บัญชี|\/accounts)$/i.test(text)) {
    const allUsers = db.getAllUsers();
    const registeredUsers = allUsers.filter(u => u.bankName && u.accountNumber);
    
    if (registeredUsers.length === 0) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีสมาชิกบันทึกบัญชีในระบบค่ะ 😊\nรบกวนพิมพ์ "บันทึกบัญชี [ธนาคาร] [เลขบัญชี] [ชื่อ]" เพื่อบันทึกนะคะ'
      });
    }

    let accountsListText = `📋 ข้อมูลเลขบัญชีของสมาชิกในกลุ่ม (น้องส้มบันทึกไว้ค่ะ):\n\n`;
    registeredUsers.forEach((u, index) => {
      const bankLabel = getBankLabel(u.bankName);
      accountsListText += `${index + 1}. ${u.displayName}\n   ${bankLabel}\n   🔢 เลขบัญชี: ${u.accountNumber}\n   👤 ชื่อ: ${u.accountName || u.displayName}\n\n`;
    });
    accountsListText += `สามารถคัดลอกเลขบัญชีไปโอนเงินได้เลยนะคะ 😊`;

    return line.replyMessage(replyToken, { type: 'text', text: accountsListText });
  }

  // 4. JOIN BILL COMMAND
  if (/^(เข้าร่วม|ร่วมหาร|ร่วมปาร์ตี้)$/i.test(text)) {
    const activeBill = db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีบิลที่เปิดอยู่ขณะนี้ค่ะ รบกวนส่งรูปใบเสร็จหรือพิมพ์ลงรายการค่าใช้จ่ายก่อนนะคะ 😊'
      });
    }

    if (activeBill.status !== 'collecting') {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'บิลนี้สรุปยอดเรียบร้อยแล้วค่ะ 😊'
      });
    }

    const profile = await line.getUserProfile(userId, groupId);
    db.saveUser(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    });

    const updatedBill = db.updateBill(activeBill.id, (b) => {
      if (!b.participants.some(p => p.userId === userId)) {
        b.participants.push({
          userId: userId,
          displayName: profile.displayName,
          share: 0,
          hasPaid: false
        });
      }
      return b;
    });

    const names = updatedBill.participants.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n');
    let total = updatedBill.payers.reduce((sum, p) => sum + p.amountPaid, 0);
    const splitAmount = Math.round((total / updatedBill.participants.length) * 100) / 100;

    const replyMsg = `🙋‍♂️ ${profile.displayName} เข้าร่วมหารแล้วค่ะ!

ปาร์ตี้/มื้ออาหาร: ${updatedBill.title}
ยอดรวมสะสม: ${total.toLocaleString('th-TH')} บาท

👥 สมาชิกที่เข้าร่วม (${updatedBill.participants.length} คน):
${names}

💰 เฉลี่ยคนละประมาณ: ${splitAmount.toLocaleString('th-TH')} บาท

👉 พิมพ์ "เข้าร่วม" เพิ่มได้ค่ะ
👉 เมื่อลงรายการครบแล้ว พิมพ์ "สรุปยอด" ได้เลยนะคะ 😊`;

    return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
  }

  // 5. START MULTI-PAYER PARTY COMMAND
  const multiRegex = /^(?:เริ่ม\s*เฉลี่ย|เริ่ม\s*ปาร์ตี้|สร้าง\s*ปาร์ตี้)\s*(.+)?$/i;
  if (multiRegex.test(text)) {
    const match = text.match(multiRegex);
    const title = match[1] || 'ปาร์ตี้หารค่าใช้จ่าย';

    const profile = await line.getUserProfile(userId, groupId);
    db.saveUser(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    });

    const bill = db.createBill(groupId, userId, title, 'multi');
    const updatedBill = db.updateBill(bill.id, (b) => {
      b.participants.push({
        userId: userId,
        displayName: profile.displayName,
        share: 0,
        hasPaid: false
      });
      return b;
    });

    const replyMsg = `📢 น้องส้มเปิดรับลงรายจ่ายปาร์ตี้เรียบร้อยค่ะ!

ปาร์ตี้: ${updatedBill.title}

👥 สมาชิกที่เข้าร่วมแล้ว:
1. ${profile.displayName}

👉 พิมพ์ "เข้าร่วม" เพื่อเข้าปาร์ตี้
👉 ผู้ชำระเงิน พิมพ์ "จ่าย [ยอด] ค่า [รายการ]" หรือส่งรูปสลิป/ใบเสร็จเข้ามาได้เลยค่ะ
👉 สรุปยอดพิมพ์ "สรุปยอด" นะคะ 😊`;

    return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
  }

  // 6. RECORD EXPENSE COMMAND (Precise Payer Auto-Join & Payer Assignment)
  const payPrefixRegex = /^(?:จ่าย|ออกค่า)\s+(\d+(?:\.\d+)?)(?:\s+(.+))?$/i;
  const addPrefixRegex = /^(?:บวก|เพิ่ม|บวกเพิ่ม)\s+(\d+(?:\.\d+)?)(?:\s+(.+))?$/i;
  const addSuffixRegex = /^(.+)\s+(\d+(?:\.\d+)?)$/i;

  let payAmount = 0;
  let payItemName = '';

  if (payPrefixRegex.test(text)) {
    const match = text.match(payPrefixRegex);
    payAmount = parseFloat(match[1]);
    payItemName = match[2] || 'ค่าใช้จ่ายทั่วไป';
  } else if (addPrefixRegex.test(text)) {
    const match = text.match(addPrefixRegex);
    payAmount = parseFloat(match[1]);
    payItemName = match[2] || 'รายการเพิ่มเติม';
  } else if (addSuffixRegex.test(text)) {
    const match = text.match(addSuffixRegex);
    payItemName = match[1].trim();
    payAmount = parseFloat(match[2]);
  }

  if (payAmount > 0) {
    const profile = await line.getUserProfile(userId, groupId);
    db.saveUser(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    });

    let activeBill = db.getActiveBill(groupId);
    if (!activeBill) {
      activeBill = db.createBill(groupId, userId, payItemName, 'multi');
    }

    const updatedBill = db.updateBill(activeBill.id, (b) => {
      // Auto-add sender to participants if not present
      if (!b.participants.some(p => p.userId === userId)) {
        b.participants.push({
          userId: userId,
          displayName: profile.displayName,
          share: 0,
          hasPaid: false
        });
      }
      // Assign sender as the exact payer of this item
      b.payers.push({
        userId: userId,
        displayName: profile.displayName,
        amountPaid: payAmount,
        itemName: payItemName,
        timestamp: Date.now()
      });
      return b;
    });

    const names = updatedBill.participants.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n');
    let total = updatedBill.payers.reduce((sum, p) => sum + p.amountPaid, 0);
    const splitAmount = Math.round((total / updatedBill.participants.length) * 100) / 100;

    const replyMsg = `✨ บันทึกรายจ่ายเพิ่มเติมเรียบร้อยค่ะ! 📝

👤 ผู้ชำระ: ${profile.displayName}
➕ เพิ่มรายการ: ${payItemName} (${payAmount.toLocaleString('th-TH')} บาท)
💵 ยอดรวมสะสมมื้อนี้: ${total.toLocaleString('th-TH')} บาท

👥 สมาชิกที่เข้าร่วม (${updatedBill.participants.length} คน):
${names}

💰 ตกคนละประมาณ: ${splitAmount.toLocaleString('th-TH')} บาท

👉 เพื่อนคนอื่นพิมพ์ "เข้าร่วม" เพื่อเข้าหาร
👉 เมื่อลงรายการครบแล้วพิมพ์ "สรุปยอด" ได้เลยนะคะ 😊`;

    return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
  }

  // 7. SETTLE / CALCULATE BILL COMMAND
  if (/^(สรุปยอด|คำนวณ|คิดเงิน|สรุปบิล)$/i.test(text)) {
    const activeBill = db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีปาร์ตี้หรือบิลที่เปิดอยู่ขณะนี้ค่ะ 😊'
      });
    }

    const updatedBill = calculateSettlement(activeBill.id);
    if (!updatedBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ไม่สามารถคำนวณยอดได้ในขณะนี้ค่ะ'
      });
    }

    const numParticipants = updatedBill.participants.length;
    const totalAmount = updatedBill.totalAmount || 0;
    const splitAmount = numParticipants > 0 ? (totalAmount / numParticipants) : 0;

    let replyMsg = `📋 สรุปยอดเงินปาร์ตี้ (น้องส้มคิดเงินเรียบร้อยค่ะ):

ปาร์ตี้/มื้ออาหาร: ${updatedBill.title}
ยอดรวมทั้งสิ้น: ${totalAmount.toLocaleString('th-TH')} บาท
เฉลี่ยคนละ (${numParticipants} คน): ${Math.round(splitAmount * 100) / 100} บาท

📊 สรุปยอดจ่ายสะสมของแต่ละคน:
`;

    if (updatedBill.participantBalances) {
      updatedBill.participantBalances.forEach(p => {
        if (p.net > 0.05) {
          replyMsg += `• ${p.displayName}: ออกเงินไป ${p.totalPaid.toLocaleString('th-TH')} บาท (ได้รับคืน ${p.net.toLocaleString('th-TH')} บาท)\n`;
        } else if (p.net < -0.05) {
          replyMsg += `• ${p.displayName}: ออกเงินไป ${p.totalPaid.toLocaleString('th-TH')} บาท (ต้องโอนเพิ่ม ${Math.abs(p.net).toLocaleString('th-TH')} บาท)\n`;
        } else {
          replyMsg += `• ${p.displayName}: ออกเงินไป ${p.totalPaid.toLocaleString('th-TH')} บาท (จ่ายพอดีเป๊ะ)\n`;
        }
      });
    }

    replyMsg += `\n👇 รายการโอนเงินคืน (โอนคืนให้ตรงบัญชีผู้รับโอนนะคะ):\n\n`;

    if (!updatedBill.transfers || updatedBill.transfers.length === 0) {
      replyMsg += `🎉 สมาชิกทุกท่านจ่ายเงินเท่ากันพอดี ไม่ต้องโอนคืนกันค่ะ`;
    } else {
      updatedBill.transfers.forEach((t, index) => {
        const receiver = db.getUser(t.toUserId);
        let bankText = 'ยังไม่ได้บันทึกบัญชีในระบบค่ะ';
        if (receiver && receiver.bankName && receiver.accountNumber) {
          bankText = `${getBankLabel(receiver.bankName)}\n   เลขบัญชี: ${receiver.accountNumber}\n   ชื่อบัญชี: ${receiver.accountName || receiver.displayName}`;
        }

        replyMsg += `${index + 1}. ${t.fromName} ➡️ โอนให้ ${t.toName}\n   💵 ยอดโอน: ${t.amount.toLocaleString('th-TH')} บาท\n   ${bankText}\n\n`;
      });
    }

    replyMsg += `👉 โอนเงินเรียบร้อยแล้วพิมพ์ "ปิดบิล" เพื่อจบรายการนะคะ 😊`;

    return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
  }

  // 8. CLOSE BILL / CANCEL BILL
  if (/^(ปิดบิล|เคลียร์แล้ว)$/i.test(text)) {
    const activeBill = db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ไม่มีบิลที่เปิดอยู่ขณะนี้ค่ะ 😊'
      });
    }

    db.updateBill(activeBill.id, (b) => {
      b.status = 'closed';
      b.closedAt = Date.now();
      return b;
    });

    return line.replyMessage(replyToken, {
      type: 'text',
      text: `🎉 ปิดบิล "${activeBill.title}" เรียบร้อยแล้วค่ะ!\nเคลียร์เงินครบถ้วน ขอบคุณทุกท่านที่ใช้บริการน้องส้มนะคะ 💚`
    });
  }

  if (/^(ยกเลิกปาร์ตี้|ยกเลิกบิล|ยกเลิกหาร)$/i.test(text)) {
    const activeBill = db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ไม่มีบิลให้ยกเลิกค่ะ 😊'
      });
    }

    db.updateBill(activeBill.id, (b) => {
      b.status = 'closed';
      b.cancelledAt = Date.now();
      return b;
    });

    return line.replyMessage(replyToken, {
      type: 'text',
      text: `ยกเลิกบิล "${activeBill.title}" เรียบร้อยแล้วค่ะ 😊`
    });
  }

  return null;
}

/**
 * Handle postback
 */
async function handlePostback(event) {
  return null;
}

/**
 * Settlement Engine (Multi-Payer Net Balance Calculation & Transaction Minimization)
 */
function calculateSettlement(billId) {
  return db.updateBill(billId, (b) => {
    b.status = 'settling';
    b.settledAt = Date.now();
    b.transfers = [];

    const numParticipants = b.participants.length;
    if (numParticipants === 0) {
      return b;
    }

    const totalExpense = (b.payers || []).reduce((sum, p) => sum + p.amountPaid, 0);
    b.totalAmount = totalExpense;

    const sharePerPerson = Math.round((totalExpense / numParticipants) * 100) / 100;

    const participantBalances = b.participants.map(p => {
      const totalPaidByUser = (b.payers || [])
        .filter(pr => pr.userId === p.userId)
        .reduce((sum, pr) => sum + pr.amountPaid, 0);
      
      p.share = sharePerPerson;
      
      return {
        userId: p.userId,
        displayName: p.displayName,
        totalPaid: totalPaidByUser,
        net: Math.round((totalPaidByUser - sharePerPerson) * 100) / 100
      };
    });

    b.participantBalances = participantBalances;

    const debtors = participantBalances
      .filter(p => p.net < -0.05)
      .map(p => ({ ...p, net: -p.net }));
    
    const creditors = participantBalances
      .filter(p => p.net > 0.05)
      .map(p => ({ ...p }));

    debtors.sort((a, b) => b.net - a.net);
    creditors.sort((a, b) => b.net - a.net);

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const transferAmount = Math.min(debtor.net, creditor.net);
      if (transferAmount > 0.05) {
        b.transfers.push({
          fromUserId: debtor.userId,
          fromName: debtor.displayName,
          toUserId: creditor.userId,
          toName: creditor.displayName,
          amount: Math.round(transferAmount * 100) / 100
        });
      }

      debtor.net -= transferAmount;
      creditor.net -= transferAmount;

      if (debtor.net < 0.05) dIdx++;
      if (creditor.net < 0.05) cIdx++;
    }

    return b;
  });
}

/**
 * Help text reply (Persona: น้องส้ม)
 */
function sendHelpMessage(replyToken) {
  const helpText = `สวัสดีค่ะ น้องส้มผู้ช่วยหารค่าอาหารประจำกลุ่มรายงานตัวค่ะ 😊

💡 คำสั่งใช้งานกับน้องส้ม:

1. บันทึกบัญชีของคุณ (สำหรับรับเงินคืน)
👉 พิมพ์: บันทึกบัญชี [ธนาคาร] [เลขบัญชี] [ชื่อบัญชี]
เช่น: บันทึกบัญชี กรุงเทพ 123-4-56789-0 สมชาย

2. เรียกดูบัญชีสมาชิกในกลุ่ม
👉 พิมพ์: ดูบัญชี หรือ ตรวจ บัญชี

3. ลงรายการค่าอาหาร/ค่าใช้จ่าย (จำผู้ชำระเงินทุกคน)
👉 พิมพ์: "ค่าขนม 200" หรือ "จ่าย 800 ค่าเค้ก"
👉 หรือ 📸 ถ่ายรูปสลิป/ใบเสร็จส่งเข้ามาในกลุ่มได้เลยค่ะ!

4. คิดเงินสรุปยอด (คำนวณผู้รับคืน/โอนเพิ่มอัตโนมัติ)
👉 พิมพ์: สรุปยอด`;

  return line.replyMessage(replyToken, {
    type: 'text',
    text: helpText
  });
}

module.exports = {
  handleEvent
};

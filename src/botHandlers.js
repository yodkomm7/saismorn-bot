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
 * Helper to generate PromptPay QR Code URL
 */
function getPromptPayQrUrl(accountNumber = '', amount = 0) {
  const cleanNumber = accountNumber.replace(/[^0-9]/g, '');
  if (cleanNumber.length === 10 || cleanNumber.length === 13) {
    if (amount > 0) {
      return `https://promptpay.io/${cleanNumber}/${amount}.png`;
    }
    return `https://promptpay.io/${cleanNumber}.png`;
  }
  return null;
}

/**
 * Categorize an expense item by keyword-matching its name (Thai/English)
 */
function categorizeExpense(itemName = '') {
  const name = itemName.toLowerCase();

  const foodKeywords = ['อาหาร', 'ข้าว', 'กับข้าว', 'ชาบู', 'หมูกระทะ', 'บุฟเฟ่ต์', 'บุฟเฟต์', 'เครื่องดื่ม', 'กาแฟ', 'ขนม', 'ของกิน', 'มื้อเช้า', 'มื้อเที่ยง', 'มื้อเย็น', 'อาหารเช้า', 'อาหารเที่ยง', 'อาหารเย็น', 'delivery', 'เดลิเวอรี่', 'ร้านอาหาร', 'ก๋วยเตี๋ยว', 'ปิ้งย่าง', 'สุกี้', 'ของหวาน', 'เบเกอรี่', 'ชานม', 'บิงซู', 'ร้านกาแฟ', 'คาเฟ่', 'บุฟเฟต', 'ส้มตำ', 'ลาบ', 'น้ำตก', 'ต้มยำ', 'แกง', 'ผัดไทย', 'ยำ', 'ก๋วยจั๊บ', 'ข้าวมันไก่', 'ข้าวหมูแดง', 'ข้าวขาหมู', 'เค้ก', 'ไอศกรีม', 'ผลไม้', 'น้ำอัดลม', 'นม', 'ชา', 'มาม่า', 'บะหมี่', 'หมูปิ้ง', 'ลูกชิ้น', 'ไก่ทอด', 'เบอร์เกอร์', 'พิซซ่า', 'สเต็ก', 'ซูชิ', 'ราเมง', 'ติ่มซำ', 'ยำวุ้นเส้น', 'ไก่ย่าง', 'หมูย่าง', 'อาหารทะเล', 'ซีฟู้ด'];
  const stayKeywords = ['โรงแรม', 'ที่พัก', 'รีสอร์ท', 'hotel', 'resort', 'โฮสเทล', 'hostel', 'ห้องพัก', 'บ้านพัก', 'คอนโด', 'homestay', 'โฮมสเตย์', 'แคมป์ปิ้ง'];
  const transportKeywords = ['รถ', 'แท็กซี่', 'taxi', 'grab', 'ตั๋ว', 'เครื่องบิน', 'น้ำมัน', 'ทางด่วน', 'รถเช่า', 'เรือ', 'รถทัวร์', 'รถไฟ', 'ค่าโดยสาร', 'วินมอเตอร์ไซค์', 'มอเตอร์ไซค์รับจ้าง', 'bts', 'mrt', 'ทางพิเศษ', 'ค่าเดินทาง', 'ค่าน้ำมัน'];

  if (foodKeywords.some(k => name.includes(k))) return 'ค่าอาหาร';
  if (stayKeywords.some(k => name.includes(k))) return 'ค่าที่พัก';
  if (transportKeywords.some(k => name.includes(k))) return 'ค่าเดินทาง';
  return 'ค่าอื่นๆ';
}

function getCategoryEmoji(category) {
  const map = { 'ค่าอาหาร': '🍽️', 'ค่าที่พัก': '🏨', 'ค่าเดินทาง': '🚗', 'ค่าอื่นๆ': '📦' };
  return map[category] || '📦';
}

/**
 * Build a Flex Message bubble showing the QR code together with the
 * recipient's name (and amount, if any) so the image is self-explanatory
 * even if saved/forwarded on its own.
 */
function makeQrFlexMessage({ recipientName, amount = 0, qrUrl, payerName = null }) {
  const bodyContents = [
    {
      type: 'text',
      text: `👤 ผู้รับเงิน: ${recipientName}`,
      weight: 'bold',
      size: 'md',
      color: '#1F2937',
      wrap: true
    }
  ];

  if (payerName) {
    bodyContents.push({
      type: 'text',
      text: `🙋 โอนจาก: ${payerName}`,
      size: 'sm',
      color: '#6B7280',
      wrap: true
    });
  }

  if (amount > 0) {
    bodyContents.push({
      type: 'text',
      text: `💵 จำนวนเงิน: ${amount.toLocaleString('th-TH')} บาท`,
      weight: 'bold',
      size: 'lg',
      color: '#059669',
      margin: 'sm'
    });
  }

  return {
    type: 'flex',
    altText: amount > 0
      ? `QR โอนเงินให้ ${recipientName} จำนวน ${amount.toLocaleString('th-TH')} บาท`
      : `QR รับเงินของ ${recipientName}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      hero: {
        type: 'image',
        url: qrUrl,
        size: 'full',
        aspectRatio: '1:1',
        aspectMode: 'fit',
        backgroundColor: '#FFFFFF'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: bodyContents
      }
    }
  };
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
1. 📸 **สแกนใบเสร็จ/สลิป:** ถ่ายรูปใบเสร็จส่งในกลุ่ม น้องส้มจะบันทึกยอดเงินให้อัตโนมัติ!
2. 🪪 **บันทึก PromptPay QR:** พิมพ์ "บันทึกบัญชี 0891234567 สมชาย" (บอทสร้างรูป QR โอนเงินให้อัตโนมัติ!)
3. 💸 **ลงรายการค่าใช้จ่าย:** พิมพ์ "ค่าขนม 200" หรือ "จ่าย 800 ค่าเค้ก"
4. ❌ **ลบรายการที่พิมพ์ผิด:** พิมพ์ "ดูรายการ" แล้วสั่ง "ลบรายการ 2"
5. 🧮 **คิดเงินสรุปยอด:** พิมพ์ "สรุปยอด" (สร้างรูป QR พร้อมระบุยอดโอนให้อัตโนมัติ!)

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
  await db.saveUser(userId, {
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl
  });

  let activeBill = await db.getActiveBill(groupId);
  if (!activeBill) {
    activeBill = await db.createBill(groupId, userId, scanResult.merchantName, 'multi');
  }

  const updatedBill = await db.updateBill(activeBill.id, (b) => {
    if (!b.participants.some(p => p.userId === userId)) {
      b.participants.push({
        userId: userId,
        displayName: profile.displayName,
        share: 0,
        hasPaid: false
      });
    }
    const category = categorizeExpense(scanResult.merchantName);
    b.payers.push({
      userId: userId,
      displayName: profile.displayName,
      amountPaid: scanResult.totalAmount,
      itemName: scanResult.merchantName,
      category: category,
      timestamp: Date.now()
    });
    return b;
  });

  const names = updatedBill.participants.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n');
  let total = updatedBill.payers.reduce((sum, p) => sum + p.amountPaid, 0);
  const splitAmount = Math.round((total / updatedBill.participants.length) * 100) / 100;
  const lastCategory = updatedBill.payers[updatedBill.payers.length - 1].category;

  const replyMsg = `✨ น้องส้มอ่านสลิป/ใบเสร็จเรียบร้อยค่ะ 🧾

👤 ผู้ชำระ: ${profile.displayName}
🏪 รายการ: ${scanResult.merchantName} (${scanResult.totalAmount.toLocaleString('th-TH')} บาท)
${getCategoryEmoji(lastCategory)} หมวดหมู่: ${lastCategory}

💵 ยอดรวมสะสมมื้อนี้: ${total.toLocaleString('th-TH')} บาท

👥 สมาชิกที่เข้าร่วม (${updatedBill.participants.length} คน):
${names}

💰 ตกคนละประมาณ: ${splitAmount.toLocaleString('th-TH')} บาท

👉 พิมพ์ "ดูรายการ" เพื่อดูสเปกรายการทั้งหมด
👉 สมาชิกพิมพ์ "เข้าร่วม" เพื่อเข้าหาร
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

  // 2. REGISTER BANK ACCOUNT / PROMPTPAY COMMAND
  if (/^(บันทึก|บันทึก\s*บัญชี|บันทึก\s*เลขบัญชี)/i.test(text)) {
    const registerRegex = /^(?:บันทึก|บันทึก\s*บัญชี|บันทึก\s*เลขบัญชี)\s+(.+)$/i;
    
    if (registerRegex.test(text)) {
      const content = text.match(registerRegex)[1].trim();
      const parts = content.split(/\s+/);

      if (parts.length >= 2) {
        let bankName = 'พร้อมเพย์';
        let accountNumber = '';
        let accountName = '';

        if (parts.length >= 3) {
          bankName = parts[0];
          accountNumber = parts[1];
          accountName = parts.slice(2).join(' ');
        } else {
          accountNumber = parts[0];
          accountName = parts[1];
        }

        const profile = await line.getUserProfile(userId, groupId);
        const user = await db.saveUser(userId, {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          bankName,
          accountNumber,
          accountName
        });

        const bankLabel = getBankLabel(user.bankName);
        const qrUrl = getPromptPayQrUrl(user.accountNumber);

        let replyMsgText = `✨ บันทึกข้อมูลบัญชีเรียบร้อยค่ะ!

${bankLabel}
🔢 เลข/เบอร์: ${user.accountNumber}
👤 ชื่อบัญชี: ${user.accountName}`;

        if (qrUrl) {
          replyMsgText += `\n\n📸 น้องส้มสร้างรูป QR Code สำหรับสแกนจ่ายให้อัตโนมัติแล้วค่ะ! 👇`;
          
          return line.replyMessage(replyToken, [
            { type: 'text', text: replyMsgText },
            makeQrFlexMessage({
              recipientName: user.accountName || user.displayName,
              qrUrl
            })
          ]);
        }

        return line.replyMessage(replyToken, { type: 'text', text: replyMsgText });
      }
    }

    return line.replyMessage(replyToken, {
      type: 'text',
      text: '📌 รบกวนระบุข้อมูลบัญชีให้ครบถ้วนนะคะ 😊\n\nรูปแบบ: บันทึกบัญชี [ธนาคาร/พร้อมเพย์] [เลขบัญชี/เบอร์โทร] [ชื่อเจ้าของ]\n\nตัวอย่าง:\nบันทึกบัญชี พร้อมเพย์ 0891234567 สมชาย'
    });
  }

  // 3. VIEW BANK ACCOUNTS / PROMPTPAY QR CODES
  if (/^(ดู\s*บัญชี|ดู\s*เลขบัญชี|ตรวจ\s*บัญชี|เช็ค\s*บัญชี|\/accounts)$/i.test(text)) {
    const allUsers = await db.getAllUsers();
    const registeredUsers = allUsers.filter(u => u.bankName && u.accountNumber);
    
    if (registeredUsers.length === 0) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีสมาชิกบันทึกบัญชีในระบบค่ะ 😊\nรบกวนพิมพ์ "บันทึกบัญชี [เลขบัญชี/เบอร์โทร] [ชื่อ]" เพื่อบันทึกนะคะ'
      });
    }

    let accountsListText = `📋 ข้อมูลเลขบัญชีของสมาชิกในกลุ่ม (น้องส้มบันทึกไว้ค่ะ):\n\n`;
    const messages = [];

    registeredUsers.forEach((u, index) => {
      const bankLabel = getBankLabel(u.bankName);
      accountsListText += `${index + 1}. ${u.displayName}\n   ${bankLabel}\n   🔢 เลข/เบอร์: ${u.accountNumber}\n   👤 ชื่อ: ${u.accountName || u.displayName}\n\n`;
    });
    accountsListText += `สามารถคัดลอกเลขบัญชี หรือสแกนรูป QR ด้านล่างเพื่อโอนได้เลยนะคะ 😊`;

    messages.push({ type: 'text', text: accountsListText });

    // Send PromptPay QR images for registered users (Max 4 images to avoid LINE 5-message limit)
    registeredUsers.slice(0, 4).forEach(u => {
      const qrUrl = getPromptPayQrUrl(u.accountNumber);
      if (qrUrl) {
        messages.push(makeQrFlexMessage({
          recipientName: u.accountName || u.displayName,
          qrUrl
        }));
      }
    });

    return line.replyMessage(replyToken, messages);
  }

  // 4. VIEW LOGGED EXPENSE ITEMS IN ACTIVE BILL
  if (/^(ดู\s*รายการ|เช็ค\s*รายการ|รายการ|รายการ\s*ทั้งหมด)$/i.test(text)) {
    const activeBill = await db.getActiveBill(groupId);
    if (!activeBill || !activeBill.payers || activeBill.payers.length === 0) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีรายการค่าใช้จ่ายบันทึกอยู่ในบิลขณะนี้ค่ะ 😊'
      });
    }

    let itemListText = `📝 รายการค่าใช้จ่ายทั้งหมดในบิลนี้ (${activeBill.title}):\n\n`;
    activeBill.payers.forEach((item, index) => {
      const category = item.category || categorizeExpense(item.itemName);
      itemListText += `${index + 1}. ${getCategoryEmoji(category)} [${category}] ${item.itemName} - ${item.amountPaid.toLocaleString('th-TH')} บาท (จ่ายโดย: ${item.displayName})\n`;
    });

    let total = activeBill.payers.reduce((sum, p) => sum + p.amountPaid, 0);
    itemListText += `\n💵 ยอดรวมสะสมขณะนี้: ${total.toLocaleString('th-TH')} บาท\n\n👉 หากต้องการลบรายการที่ใส่ผิด ให้พิมพ์: "ลบรายการ [ลำดับ]" (เช่น ลบรายการ 2)`;

    return line.replyMessage(replyToken, { type: 'text', text: itemListText });
  }

  // 5. DELETE / CANCEL SPECIFIC EXPENSE ITEM
  const deleteItemRegex = /^(?:ลบ\s*รายการ|ยกเลิก\s*รายการ|ลบ\s*ยอด)\s+(\d+)$/i;
  if (deleteItemRegex.test(text)) {
    const itemIndex = parseInt(text.match(deleteItemRegex)[1]) - 1;

    const activeBill = await db.getActiveBill(groupId);
    if (!activeBill || !activeBill.payers || activeBill.payers.length === 0) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีรายการให้ลบค่ะ 😊'
      });
    }

    if (itemIndex < 0 || itemIndex >= activeBill.payers.length) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: `ไม่พบลำดับรายการที่ ${itemIndex + 1} ค่ะ 😊\nพิมพ์ "ดูรายการ" เพื่อเช็คลำดับรายการทั้งหมดก่อนนะคะ!`
      });
    }

    let deletedItemName = '';
    let deletedAmount = 0;

    const updatedBill = await db.updateBill(activeBill.id, (b) => {
      const removed = b.payers.splice(itemIndex, 1)[0];
      if (removed) {
        deletedItemName = removed.itemName;
        deletedAmount = removed.amountPaid;
      }
      return b;
    });

    let total = updatedBill.payers.reduce((sum, p) => sum + p.amountPaid, 0);

    const replyMsg = `❌ ลบรายการที่ ${itemIndex + 1} (${deletedItemName} ${deletedAmount.toLocaleString('th-TH')} บาท) เรียบร้อยค่ะ!

💵 ยอดรวมสะสมอัปเดตเป็น: ${total.toLocaleString('th-TH')} บาท

👉 พิมพ์ "ดูรายการ" เพื่อเช็ครายการทั้งหมด
👉 พิมพ์ "สรุปยอด" เมื่อลงครบเรียบร้อยนะคะ 😊`;

    return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
  }

  // 6. JOIN BILL COMMAND
  if (/^(เข้าร่วม|ร่วมหาร|ร่วมปาร์ตี้)$/i.test(text)) {
    const activeBill = await db.getActiveBill(groupId);
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
    await db.saveUser(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    });

    const updatedBill = await db.updateBill(activeBill.id, (b) => {
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

  // 7. START MULTI-PAYER PARTY COMMAND
  const multiRegex = /^(?:เริ่ม\s*เฉลี่ย|เริ่ม\s*ปาร์ตี้|สร้าง\s*ปาร์ตี้)\s*(.+)?$/i;
  if (multiRegex.test(text)) {
    const match = text.match(multiRegex);
    const title = match[1] || 'ปาร์ตี้หารค่าใช้จ่าย';

    const profile = await line.getUserProfile(userId, groupId);
    await db.saveUser(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    });

    const bill = await db.createBill(groupId, userId, title, 'multi');
    const updatedBill = await db.updateBill(bill.id, (b) => {
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

  // 8. RECORD EXPENSE COMMAND
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
    await db.saveUser(userId, {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    });

    let activeBill = await db.getActiveBill(groupId);
    if (!activeBill) {
      activeBill = await db.createBill(groupId, userId, payItemName, 'multi');
    }

    const updatedBill = await db.updateBill(activeBill.id, (b) => {
      if (!b.participants.some(p => p.userId === userId)) {
        b.participants.push({
          userId: userId,
          displayName: profile.displayName,
          share: 0,
          hasPaid: false
        });
      }
      const category = categorizeExpense(payItemName);
      b.payers.push({
        userId: userId,
        displayName: profile.displayName,
        amountPaid: payAmount,
        itemName: payItemName,
        category: category,
        timestamp: Date.now()
      });
      return b;
    });

    const names = updatedBill.participants.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n');
    let total = updatedBill.payers.reduce((sum, p) => sum + p.amountPaid, 0);
    const splitAmount = Math.round((total / updatedBill.participants.length) * 100) / 100;
    const lastCategory = updatedBill.payers[updatedBill.payers.length - 1].category;

    const replyMsg = `✨ บันทึกรายจ่ายเพิ่มเติมเรียบร้อยค่ะ! 📝

👤 ผู้ชำระ: ${profile.displayName}
➕ เพิ่มรายการ: ${payItemName} (${payAmount.toLocaleString('th-TH')} บาท)
${getCategoryEmoji(lastCategory)} หมวดหมู่: ${lastCategory}
💵 ยอดรวมสะสมมื้อนี้: ${total.toLocaleString('th-TH')} บาท

👥 สมาชิกที่เข้าร่วม (${updatedBill.participants.length} คน):
${names}

💰 ตกคนละประมาณ: ${splitAmount.toLocaleString('th-TH')} บาท

👉 หากใส่ผิดพิมพ์ "ลบรายการ [ลำดับ]" เพื่อยกเลิกได้ค่ะ
👉 เมื่อลงรายการครบแล้วพิมพ์ "สรุปยอด" ได้เลยนะคะ 😊`;

    return line.replyMessage(replyToken, { type: 'text', text: replyMsg });
  }

  // 9. SETTLE / CALCULATE BILL COMMAND (With Automatic PromptPay QR Images)
  const settleAskRegex = /^(สรุปยอด|คำนวณ|คิดเงิน|สรุปบิล)$/i;
  const settleCategoryRegex = /^(?:สรุปยอด|คำนวณ|คิดเงิน|สรุปบิล)\s*(?:แยกหมวด|แยกประเภท|แยกตามหมวด)$/i;
  const settleTotalRegex = /^(?:สรุปยอด|คำนวณ|คิดเงิน|สรุปบิล)\s*(?:รวม|รวมทั้งหมด|รวมทั้งทริป|รวมทริป)$/i;

  if (settleAskRegex.test(text)) {
    const activeBill = await db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีปาร์ตี้หรือบิลที่เปิดอยู่ขณะนี้ค่ะ 😊'
      });
    }

    return line.replyMessage(replyToken, {
      type: 'text',
      text: `ก่อนสรุปยอด อยากให้น้องส้มแสดงผลแบบไหนดีคะ? 😊

👉 พิมพ์ "สรุปยอด แยกหมวด" เพื่อดูแยกตามหมวดหมู่ (ค่าอาหาร/ที่พัก/เดินทาง/อื่นๆ)
👉 พิมพ์ "สรุปยอด รวม" เพื่อดูยอดรวมทั้งทริปแบบเดิม`
    });
  }

  if (settleCategoryRegex.test(text) || settleTotalRegex.test(text)) {
    const showCategoryBreakdown = settleCategoryRegex.test(text);

    const activeBill = await db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ยังไม่มีปาร์ตี้หรือบิลที่เปิดอยู่ขณะนี้ค่ะ 😊'
      });
    }

    const updatedBill = await calculateSettlement(activeBill.id);
    if (!updatedBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ไม่สามารถคำนวณยอดได้ในขณะนี้ค่ะ'
      });
    }

    const numParticipants = updatedBill.participants.length;
    const totalAmount = updatedBill.totalAmount || 0;
    const splitAmount = numParticipants > 0 ? (totalAmount / numParticipants) : 0;

    let replyMsgText = `📋 สรุปยอดเงินปาร์ตี้ (น้องส้มคิดเงินเรียบร้อยค่ะ):

ปาร์ตี้/มื้ออาหาร: ${updatedBill.title}
ยอดรวมทั้งสิ้น: ${totalAmount.toLocaleString('th-TH')} บาท
เฉลี่ยคนละ (${numParticipants} คน): ${Math.round(splitAmount * 100) / 100} บาท
`;

    if (showCategoryBreakdown) {
      const categoryTotals = {};
      (updatedBill.payers || []).forEach(p => {
        const category = p.category || categorizeExpense(p.itemName);
        categoryTotals[category] = (categoryTotals[category] || 0) + p.amountPaid;
      });

      replyMsgText += `\n🗂️ สรุปค่าใช้จ่ายแยกหมวดหมู่:\n`;
      Object.entries(categoryTotals).forEach(([category, amount]) => {
        replyMsgText += `${getCategoryEmoji(category)} ${category}: ${amount.toLocaleString('th-TH')} บาท\n`;
      });
    }

    replyMsgText += `\n📊 สรุปยอดจ่ายสะสมของแต่ละคน:\n`;

    if (updatedBill.participantBalances) {
      updatedBill.participantBalances.forEach(p => {
        if (p.net > 0.05) {
          replyMsgText += `• ${p.displayName}: ออกเงินไป ${p.totalPaid.toLocaleString('th-TH')} บาท (ได้รับคืน ${p.net.toLocaleString('th-TH')} บาท)\n`;
        } else if (p.net < -0.05) {
          replyMsgText += `• ${p.displayName}: ออกเงินไป ${p.totalPaid.toLocaleString('th-TH')} บาท (ต้องโอนเพิ่ม ${Math.abs(p.net).toLocaleString('th-TH')} บาท)\n`;
        } else {
          replyMsgText += `• ${p.displayName}: ออกเงินไป ${p.totalPaid.toLocaleString('th-TH')} บาท (จ่ายพอดีเป๊ะ)\n`;
        }
      });
    }

    replyMsgText += `\n👇 รายการโอนเงินคืน (กดสแกนรูป QR ด้านล่างเพื่อโอนเงินได้เลยนะคะ):\n\n`;

    const messages = [];

    if (!updatedBill.transfers || updatedBill.transfers.length === 0) {
      replyMsgText += `🎉 สมาชิกทุกท่านจ่ายเงินเท่ากันพอดี ไม่ต้องโอนคืนกันค่ะ`;
      messages.push({ type: 'text', text: replyMsgText });
    } else {
      for (let index = 0; index < updatedBill.transfers.length; index++) {
        const t = updatedBill.transfers[index];
        const receiver = await db.getUser(t.toUserId);
        let bankText = 'ยังไม่ได้บันทึกบัญชีในระบบค่ะ';
        if (receiver && receiver.bankName && receiver.accountNumber) {
          bankText = `${getBankLabel(receiver.bankName)}\n   เลข/เบอร์: ${receiver.accountNumber}\n   ชื่อบัญชี: ${receiver.accountName || receiver.displayName}`;
        }

        replyMsgText += `${index + 1}. ${t.fromName} ➡️ โอนให้ ${t.toName}\n   💵 ยอดโอนสุทธิ: ${t.amount.toLocaleString('th-TH')} บาท\n   ${bankText}\n\n`;
      }

      replyMsgText += `👉 โอนเงินเรียบร้อยแล้วพิมพ์ "ปิดบิล" เพื่อจบรายการนะคะ 😊`;
      messages.push({ type: 'text', text: replyMsgText });

      // Generate dynamic PromptPay QR code images with embedded transfer amounts
      for (const t of updatedBill.transfers.slice(0, 4)) {
        const receiver = await db.getUser(t.toUserId);
        if (receiver && receiver.accountNumber) {
          const qrUrl = getPromptPayQrUrl(receiver.accountNumber, t.amount);
          if (qrUrl) {
            messages.push(makeQrFlexMessage({
              recipientName: receiver.accountName || receiver.displayName,
              amount: t.amount,
              payerName: t.fromName,
              qrUrl
            }));
          }
        }
      }
    }

    return line.replyMessage(replyToken, messages);
  }

  // 10. CLOSE BILL / CANCEL BILL
  if (/^(ปิดบิล|เคลียร์แล้ว)$/i.test(text)) {
    const activeBill = await db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ไม่มีบิลที่เปิดอยู่ขณะนี้ค่ะ 😊'
      });
    }

    await db.updateBill(activeBill.id, (b) => {
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
    const activeBill = await db.getActiveBill(groupId);
    if (!activeBill) {
      return line.replyMessage(replyToken, {
        type: 'text',
        text: 'ไม่มีบิลให้ยกเลิกค่ะ 😊'
      });
    }

    await db.updateBill(activeBill.id, (b) => {
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
async function calculateSettlement(billId) {
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

1. บันทึก PromptPay QR ของคุณ
👉 พิมพ์: "บันทึก 0891234567 สมชาย"

2. เรียกดูบัญชีสมาชิกในกลุ่ม
👉 พิมพ์: "ดูบัญชี" หรือ "ตรวจ บัญชี"

3. ลงรายการค่าอาหาร/ค่าใช้จ่าย (น้องส้มแยกหมวดหมู่ให้อัตโนมัติ: อาหาร/ที่พัก/เดินทาง/อื่นๆ)
👉 พิมพ์: "ค่าขนม 200" หรือ "จ่าย 800 ค่าเค้ก"

4. ดูและลบรายการที่พิมพ์ผิด
👉 พิมพ์: "ดูรายการ" หรือ "ลบรายการ 2"

5. คิดเงินสรุปยอด (สร้างรูป QR พร้อมระบุยอดโอนให้อัตโนมัติ)
👉 พิมพ์: "สรุปยอด" (น้องส้มจะถามว่าจะให้แยกหมวดหรือรวมทั้งทริป)`;

  return line.replyMessage(replyToken, {
    type: 'text',
    text: helpText
  });
}

module.exports = {
  handleEvent
};

const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

let ai = null;
if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn('Failed to initialize Google GenAI SDK:', err);
  }
}

function isRetryableError(error) {
  const status = error && error.status;
  const message = (error && error.message) || '';
  return status === 503 || status === 429 || /UNAVAILABLE|overloaded|RESOURCE_EXHAUSTED/i.test(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithRetry(request, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isRetryableError(error)) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Parses a receipt image buffer using Gemini Vision AI
 */
async function scanReceipt(imageBuffer, mimeType = 'image/jpeg') {
  if (!apiKey || !ai) {
    return {
      success: false,
      reason: 'NO_API_KEY',
      message: 'ว้ายยย! ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในไฟล์ .env เลยยะ! กรุณาเพิ่ม GEMINI_API_KEY เพื่อเปิดใช้งานระบบสแกนอ่านใบเสร็จด้วย AI นะยะ!'
    };
  }

  try {
    const base64Data = imageBuffer.toString('base64');

    const response = await generateWithRetry({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        `คุณคือระบบ OCR อ่านสลิปและใบเสร็จที่แม่นยำสูง ใบเสร็จอาจเป็นภาษาใดก็ได้ (ไทย อังกฤษ จีน ญี่ปุ่น เกาหลี ฯลฯ) กรุณาวิเคราะห์รูปภาพนี้และสกัดข้อมูลสำคัญตอบกลับมาเป็น JSON สั้นๆ เท่านั้น (ห้ามมีคำเกริ่น ห้ามมี markdown codeblock อื่น):

{
  "isReceipt": true หรือ false (ถ้าเป็นใบเสร็จ สลิปโอนเงิน บิลชำระเงิน ให้เป็น true),
  "merchantName": "ชื่อร้านค้า ถ้าในใบเสร็จเป็นภาษาไทยหรืออังกฤษให้คงตามต้นฉบับ ถ้าเป็นภาษาอื่น (จีน ญี่ปุ่น เกาหลี ฯลฯ) ให้แปล/ทับศัพท์เป็นภาษาไทย เช่น แฟมิลี่มาร์ท",
  "totalAmount": ยอดเงินรวมสุทธิ (ตัวเลขอย่างเดียว เช่น 1250),
  "currency": "รหัสสกุลเงิน ISO 4217 ของยอดเงินในใบเสร็จ เช่น THB, JPY, CNY, USD, KRW (ดูจากสัญลักษณ์ ¥ $ ₩ € หรือ ประเทศ/ภาษาของใบเสร็จ; ¥ ในใบเสร็จญี่ปุ่นคือ JPY ในใบเสร็จจีนคือ CNY)",
  "category": "หนึ่งในนี้เท่านั้น: ค่าอาหาร, ค่าที่พัก, ค่าเดินทาง, ค่าอื่นๆ",
  "items": [
    {
      "name": "ชื่อรายการ ถ้าต้นฉบับเป็นภาษาไทยหรืออังกฤษให้คงตามเดิม ถ้าเป็นภาษาอื่นให้แปลเป็นภาษาไทยที่คนไทยเข้าใจ (เช่น ラーメン → ราเมง, 珍珠奶茶 → ชานมไข่มุก)",
      "originalName": "ชื่อรายการตามต้นฉบับในใบเสร็จ (ตัวอักษรเดิม ไม่แปล)",
      "price": ยอดเงินตัวเลข
    }
  ]
}`
      ]
    });

    const textOutput = response.text || '';

    // Clean JSON code blocks if present
    const cleanJson = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

    if (!result.isReceipt || !result.totalAmount) {
      return {
        success: false,
        reason: 'NOT_RECEIPT',
        message: 'ว้ายยย! รูปนี้ไม่ใช่ใบเสร็จหรือสลิปชำระเงินที่อ่านยอดได้ยะ! ส่งรูปสลิปหรือใบเสร็จชัดๆ มาใหม่อีกทีสิ!'
      };
    }

    const currency = /^[A-Z]{3}$/.test(String(result.currency || '').toUpperCase())
      ? String(result.currency).toUpperCase()
      : 'THB';
    const validCategories = ['ค่าอาหาร', 'ค่าที่พัก', 'ค่าเดินทาง', 'ค่าอื่นๆ'];

    return {
      success: true,
      merchantName: result.merchantName || 'ค่าอาหารตามใบเสร็จ',
      totalAmount: parseFloat(result.totalAmount),
      currency,
      category: validCategories.includes(result.category) ? result.category : null,
      items: result.items || []
    };
  } catch (error) {
    console.error('Error scanning receipt with Gemini AI:', error);

    if (isRetryableError(error)) {
      return {
        success: false,
        reason: 'AI_OVERLOADED',
        message: 'โอ๊ยยย! ตอนนี้ระบบ AI มีคนใช้งานเยอะมากค่ะ (Gemini เต็ม) รบกวนรอสักครู่แล้วลองส่งรูปใบเสร็จใหม่อีกครั้งนะคะ 🙏'
      };
    }

    return {
      success: false,
      reason: 'AI_ERROR',
      message: 'โอ๊ยยย! เกิดข้อผิดพลาดตอนน้องส้มแกะอ่านใบเสร็จค่ะ! ลองถ่ายรูปใบเสร็จให้ชัดๆ แล้วส่งมาอีกรอบนะคะ!'
    };
  }
}

module.exports = {
  scanReceipt
};

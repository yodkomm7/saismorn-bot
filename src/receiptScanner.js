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
        `คุณคือระบบ OCR อ่านสลิปและใบเสร็จภาษาไทยที่แม่นยำสูง กรุณาวิเคราะห์รูปภาพนี้และสกัดข้อมูลสำคัญตอบกลับมาเป็น JSON สั้นๆ เท่านั้น (ห้ามมีคำเกริ่น ห้ามมี markdown codeblock อื่น):

{
  "isReceipt": true หรือ false (ถ้าเป็นใบเสร็จ สลิปโอนเงิน บิลชำระเงิน ให้เป็น true),
  "merchantName": "ชื่อร้านค้า หรือชื่อประเภทมื้ออาหาร",
  "totalAmount": ยอดเงินรวมสุทธิ (ตัวเลขอย่างเดียว เช่น 1250),
  "items": [
    { "name": "ชื่อรายการอาหาร", "price": ยอดเงินตัวเลข }
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

    return {
      success: true,
      merchantName: result.merchantName || 'ค่าอาหารตามใบเสร็จ',
      totalAmount: parseFloat(result.totalAmount),
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

const express = require('express');
const dotenv = require('dotenv');
const line = require('./lineClient');
const botHandlers = require('./botHandlers');
const https = require('https');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// POST /webhook - LINE Webhook endpoint
// Handles raw signature verification before JSON parsing
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-line-signature'];
  const rawBody = req.body ? req.body.toString('utf-8') : '';

  if (!line.verifySignature(signature, rawBody)) {
    console.warn('Invalid LINE webhook signature received');
    return res.status(401).send('Unauthorized');
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (err) {
    console.error('Failed to parse webhook JSON body:', err);
    return res.status(400).send('Bad Request');
  }

  const events = body.events || [];
  
  // Process events sequentially
  for (const event of events) {
    try {
      await botHandlers.handleEvent(event);
    } catch (error) {
      console.error(`Error handling event: ${JSON.stringify(event)}`, error);
    }
  }

  return res.status(200).send('OK');
});

// GET / - Webpage for installation and commands (Premium Aesthetics & SEO Optimized)
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>น้องส้ม - ผู้ช่วยหารค่าอาหาร & สแกนใบเสร็จ</title>
  <meta name="description" content="บอทไลน์ผู้ช่วยจัดการค่าใช้จ่ายกลุ่มเพื่อน ช่วยหารค่าอาหาร บันทึกเลขบัญชี และเฉลี่ยส่วนต่าง rebalancing จากทริปหรือปาร์ตี้อย่างชาญฉลาดและรวดเร็ว">
  <!-- Google Fonts: Outfit and Prompt -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Prompt:wght@300;500;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --primary: #10B981;
      --primary-hover: #059669;
      --bg-dark: #0B0F19;
      --card-bg: rgba(17, 24, 39, 0.7);
      --text-main: #F3F4F6;
      --text-muted: #9CA3AF;
      --glow-color: rgba(16, 185, 129, 0.15);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Prompt', 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      overflow-x: hidden;
    }

    header {
      width: 100%;
      padding: 2rem 1rem;
      text-align: center;
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, transparent 100%);
    }

    .container {
      max-width: 900px;
      width: 100%;
      padding: 2rem 1.5rem;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3rem;
    }

    .hero-section {
      text-align: center;
      animation: fadeIn 1s ease-out;
    }

    h1 {
      font-family: 'Outfit', 'Prompt', sans-serif;
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(to right, #10B981, #3B82F6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-size: 1.2rem;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 2.5rem;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 80px var(--glow-color);
      transition: transform 0.3s ease, border-color 0.3s ease;
    }

    .card:hover {
      transform: translateY(-5px);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .command-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    @media (min-width: 768px) {
      .command-list {
        grid-template-columns: 1fr 1fr;
      }
    }

    .command-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: background 0.2s ease;
    }

    .command-item:hover {
      background: rgba(16, 185, 129, 0.05);
    }

    .command-tag {
      font-family: 'Outfit', sans-serif;
      font-size: 0.85rem;
      background: rgba(59, 130, 246, 0.15);
      color: #60A5FA;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      align-self: flex-start;
      font-weight: 600;
    }

    .command-syntax {
      font-size: 1.05rem;
      font-weight: 600;
      color: #FFFFFF;
    }

    .command-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .copyable {
      background: rgba(255, 255, 255, 0.05);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
      color: #E5E7EB;
    }

    .info-footer {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      font-size: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      width: 100%;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>
</head>
<body>

  <header>
    <div class="logo" style="font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; color: var(--primary);">
      NONG SOM LINE BOT - ONLINE 24/7
    </div>
  </header>

  <main class="container">
    <section class="hero-section">
      <h1 id="main-heading">น้องส้ม 🍊</h1>
      <p class="subtitle">
        บอทผู้ช่วยสแกนใบเสร็จ หารค่าอาหาร สรุปส่วนต่าง และเจนเนอเรตรูป PromptPay QR Code อัตโนมัติ!
      </p>
    </section>

    <section class="card" id="commands-card">
      <h2 class="section-title">💡 คู่มือคำสั่งการใช้งานบอท</h2>
      <div class="command-list">
        
        <div class="command-item" id="cmd-register">
          <span class="command-tag">Register PromptPay</span>
          <span class="command-syntax">บันทึก [เบอร์โทร] [ชื่อ]</span>
          <span class="command-desc">บันทึกข้อมูลพร้อมเพย์ เช่น <span class="copyable">บันทึก 0891234567 สมชาย</span> บอทจะสร้างรูป QR Code ให้อัตโนมัติ</span>
        </div>

        <div class="command-item" id="cmd-view">
          <span class="command-tag">View Accounts</span>
          <span class="command-syntax">ดูบัญชี</span>
          <span class="command-desc">แสดงรายการเลขบัญชีและรูป QR Code ของทุกคนในกลุ่ม</span>
        </div>

        <div class="command-item" id="cmd-expense">
          <span class="command-tag">Record Expense</span>
          <span class="command-syntax">ค่าขนม 200</span>
          <span class="command-desc">พิมพ์ลงรายการค่าใช้จ่าย บอทจะบันทึกคนส่งเป็นคนจ่ายและดึงเข้าหารให้อัตโนมัติ</span>
        </div>

        <div class="command-item" id="cmd-delete">
          <span class="command-tag">Delete Item</span>
          <span class="command-syntax">ลบรายการ [ลำดับ]</span>
          <span class="command-desc">พิมพ์ <span class="copyable">ดูรายการ</span> แล้วสั่งลบรายการที่พิมพ์ผิดด้วย <span class="copyable">ลบรายการ 2</span></span>
        </div>

        <div class="command-item" id="cmd-settle">
          <span class="command-tag">Calculate Settlement</span>
          <span class="command-syntax">สรุปยอด</span>
          <span class="command-desc">คำนวณหักลบเงินล่วงหน้า และสร้างรูป QR Code พร้อมระบุยอดโอนให้อัตโนมัติ</span>
        </div>

      </div>
    </section>
  </main>

  <footer class="info-footer">
    <p>© 2026 Nong Som LINE Bot. Built for instant receipt scanning & group expense splitting.</p>
  </footer>

</body>
</html>
  `;
  res.send(html);
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webhook URL is ready at http://localhost:${PORT}/webhook`);

  // Self-Ping / Keep-Alive Cron (Pings every 10 minutes to prevent Render Free Tier from sleeping)
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || 'https://saismorn-bot.onrender.com/';
  setInterval(() => {
    https.get(keepAliveUrl, (res) => {
      console.log(`[Keep-Alive] Pinged ${keepAliveUrl} - Status Code: ${res.statusCode}`);
    }).on('error', (err) => {
      console.warn(`[Keep-Alive] Ping failed:`, err.message);
    });
  }, 10 * 60 * 1000);
});

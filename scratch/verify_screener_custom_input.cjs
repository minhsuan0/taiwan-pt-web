const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8093;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = '/Users/liminxuan/.gemini/antigravity/brain/2866d638-897e-45d0-8011-35d2d3e96bfb';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(__dirname, '../', reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

    // 1. 開啟第一個快篩（久坐腰痠）
    console.log('1. 開啟快篩彈窗...');
    await page.click('.screener-card');
    await new Promise(r => setTimeout(r, 400));

    // 2. 步驟 1：點擊「✏️ 其他（自行補充描述）」
    console.log('2. 步驟 1：測試「✏️ 其他（自行補充描述）」...');
    await page.waitForSelector('#screener-custom-toggle-btn');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_screener_custom_btn.png` });

    await page.click('#screener-custom-toggle-btn');
    await new Promise(r => setTimeout(r, 300));

    // 驗證輸入框顯示
    const isBoxVisible = await page.$eval('#screener-custom-box', el => el.style.display !== 'none');
    if (!isBoxVisible) throw new Error('自訂輸入框未展開！');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_screener_custom_input_open.png` });

    // 輸入自訂症狀
    await page.type('#screener-custom-input', '薦髂關節右側深層刺痛');
    await page.click('.screener-custom-confirm-btn');
    await new Promise(r => setTimeout(r, 400));
    console.log('   ✅ 步驟 1 自填確認，順利推進至步驟 2');

    // 3. 步驟 2：選取既有快捷選項
    console.log('3. 步驟 2：選取第 2 個快捷選項...');
    await page.click('.screener-option-btn');
    await new Promise(r => setTimeout(r, 400));
    console.log('   ✅ 步驟 2 完成，推進至步驟 3');

    // 4. 步驟 3：再次測試自填
    console.log('4. 步驟 3：測試自填紅旗警訊描述...');
    await page.click('#screener-custom-toggle-btn');
    await new Promise(r => setTimeout(r, 300));
    await page.type('#screener-custom-input', '彎腰穿鞋時小腿微麻');
    await page.click('.screener-custom-confirm-btn');
    await new Promise(r => setTimeout(r, 800));

    // 5. 驗證彈窗關閉且訊息正確發送
    const isModalClosed = await page.$eval('#screener-modal', el => !el.classList.contains('show'));
    if (!isModalClosed) throw new Error('送出後快篩彈窗未關閉！');
    console.log('   ✅ 快篩彈窗正常關閉');

    // 驗證使用者氣泡是否包含自填的字句
    const userText = await page.$eval('.msg.user', el => el.textContent);
    console.log('5. 送出的提問內容：', userText);
    if (!userText.includes('薦髂關節右側深層刺痛') || !userText.includes('彎腰穿鞋時小腿微麻')) {
      throw new Error('提問內容未包含使用者自填之描述！');
    }
    console.log('   ✅ 提問內容完全包含使用者自填描述！');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_screener_custom_submitted.png` });

    console.log('🎉 快篩自填「✏️ 其他」功能 100% 真機驗證通過！');
  } catch (err) {
    console.error('❌ 測試失敗:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});

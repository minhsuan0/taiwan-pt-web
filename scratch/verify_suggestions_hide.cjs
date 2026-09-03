const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8092;
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

    // 1. 首頁初始狀態：熱門探索橫軸應顯示
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    const initialDisplay = await page.$eval('#suggestions-strip', el => window.getComputedStyle(el).display);
    console.log('1. 首頁初始橫軸 display 狀態:', initialDisplay);
    if (initialDisplay === 'none') throw new Error('首頁初始橫軸不應為 none！');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_strip_initial_visible.png` });

    // 2. 模擬使用者輸入並送出問題
    console.log('2. 模擬使用者輸入訊息並送出...');
    await page.type('#input', '久坐下背緊繃該如何改善？');
    await page.click('#action-btn');
    await new Promise(r => setTimeout(r, 400));

    // 3. 檢查送出後：熱門探索橫軸是否已隱藏
    const chattingDisplay = await page.$eval('#suggestions-strip', el => window.getComputedStyle(el).display);
    console.log('3. 送出提問後橫軸 display 狀態:', chattingDisplay);
    if (chattingDisplay !== 'none') throw new Error('送出提問後橫軸應為 none！');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_strip_hidden_after_chat.png` });

    // 4. 點擊右上角「開啟新對話」按鈕
    console.log('4. 點擊右上角開啟新對話...');
    await page.click('button[aria-label="新對話"]');
    await new Promise(r => setTimeout(r, 400));

    // 5. 檢查重置後：熱門探索橫軸是否重新出現
    const resetDisplay = await page.$eval('#suggestions-strip', el => window.getComputedStyle(el).display);
    console.log('5. 重置新對話後橫軸 display 狀態:', resetDisplay);
    if (resetDisplay === 'none') throw new Error('重置後橫軸應重新顯示！');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_strip_visible_after_reset.png` });

    console.log('🎉 橫軸顯示/隱藏切換機制 100% 驗證通過！');
  } catch (err) {
    console.error('❌ 測試失敗:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});

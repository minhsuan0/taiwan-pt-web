const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8097;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = '/Users/liminxuan/.gemini/antigravity/brain/2866d638-897e-45d0-8011-35d2d3e96bfb';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let filePath = path.join(__dirname, '../', reqPath);
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath += '.html';
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.txt': 'text/plain'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
  }
});

server.listen(PORT, async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    console.log('1. 載入 /topics/forward-head-posture (低頭族富貴包)...');
    await page.goto(`http://localhost:${PORT}/topics/forward-head-posture`, { waitUntil: 'networkidle0' });

    // 檢查相關專題推薦數量
    const relatedCards = await page.$$eval('.related-card', els => els.map(e => ({
      title: e.querySelector('.related-card-badge').textContent.trim(),
      href: e.getAttribute('href')
    })));
    console.log('   相關專題數量:', relatedCards.length);
    console.log('   推薦清單:', JSON.stringify(relatedCards, null, 2));

    if (relatedCards.length !== 3) {
      throw new Error(`推薦專題數量應為 3，實際為 ${relatedCards.length}`);
    }

    // 滾動並截圖
    await page.evaluate(() => {
      const el = document.querySelector('.related-section');
      if (el) el.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_related_topics.png` });

    // 2. 測試點擊推薦卡片進行連環跳轉
    console.log('2. 點擊第一張推薦卡片進行連環閱讀...');
    const firstHref = relatedCards[0].href;
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.related-card:first-child')
    ]);
    console.log('   跳轉後網址:', page.url());
    const newTitle = await page.$eval('h1', el => el.textContent.trim());
    console.log('   跳轉後標題:', newTitle);

    console.log('🎉 相關推薦專題網 (SEO Internal Linking) 100% 驗證通過！');
  } catch (err) {
    console.error('❌ 測試失敗:', err);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});

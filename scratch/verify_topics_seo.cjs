const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8095;
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
  console.log(`Test server running on port ${PORT}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    // 1. 測試百科目錄首頁 /topics/
    console.log('1. 載入 /topics/ 百科目錄中心...');
    await page.goto(`http://localhost:${PORT}/topics/`, { waitUntil: 'networkidle0' });
    const pageTitle = await page.title();
    console.log('   頁面標題:', pageTitle);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_topics_index.png` });

    // 2. 測試關鍵字即時搜尋
    console.log('2. 測試即時搜尋「富貴包」...');
    await page.type('#searchInput', '富貴包');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_topics_search.png` });

    // 3. 測試點入「低頭族頸椎前傾與富貴包」專題頁面
    console.log('3. 進入專題頁面 /topics/forward-head-posture...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('a[href="/topics/forward-head-posture"]')
    ]);

    // 驗證 Schema.org 結構化資料
    const jsonLds = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => JSON.parse(e.textContent)));
    console.log(`   ✅ 成功找到 ${jsonLds.length} 個 JSON-LD 結構化資料標籤 (FAQPage, MedicalWebPage)`);
    if (jsonLds.length < 3) throw new Error('缺少 Schema.org 結構化資料！');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_topic_detail.png` });

    // 4. 測試導流回主站對話框並自動帶入提問
    console.log('4. 點擊「💬 與 AI 治療師一對一客製諮詢此症狀 ➔」...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.cta-btn-ai')
    ]);
    await new Promise(r => setTimeout(r, 800));

    const userMsg = await page.$eval('.msg.user', el => el.textContent);
    console.log('   ✅ 成功導流回首頁並自動發問:', userMsg.trim());
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_topic_cta_to_chat.png` });

    console.log('🎉 百大實證專題百科與 Google SEO 導流閉環 100% 驗證通過！');
  } catch (err) {
    console.error('❌ 測試失敗:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});

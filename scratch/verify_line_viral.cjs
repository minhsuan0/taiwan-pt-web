const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8096;
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

    // 1. 驗證專題頁面內的 LINE 一鍵分享按鈕
    console.log('1. 檢驗 /topics/forward-head-posture 的 LINE 分享按鈕...');
    await page.goto(`http://localhost:${PORT}/topics/forward-head-posture`, { waitUntil: 'networkidle0' });
    const lineShareHref = await page.$eval('.cta-btn-share-line', el => el.getAttribute('href'));
    console.log('   LINE Share Href:', lineShareHref.substring(0, 80) + '...');
    if (!lineShareHref.includes('social-plugins.line.me/lineit/share')) {
      throw new Error('LINE 分享按鈕連結格式不正確');
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_topic_bottom_cta.png` });

    // 2. 驗證百科首頁的 LINE 分享按鈕
    console.log('2. 檢驗 /topics/ 的頂部 LINE 分享按鈕...');
    await page.goto(`http://localhost:${PORT}/topics/`, { waitUntil: 'networkidle0' });
    const topShareHref = await page.$eval('.top-header a[href*="lineit"]', el => el.getAttribute('href'));
    console.log('   Top Header LINE Share Href:', topShareHref.substring(0, 80) + '...');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test_topics_index_line.png` });

    console.log('🎉 LINE 病毒式裂變與一鍵分享功能驗證 100% 通過！');
  } catch (err) {
    console.error('❌ 測試失敗:', err);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});

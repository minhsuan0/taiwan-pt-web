/**
 * Static SEO Topic Pages & Sitemap Generator
 * Generates:
 * 1. topics/index.html (百科首頁 / 搜尋目錄)
 * 2. topics/[slug].html (104 篇靜態 SEO 專題網頁，內嵌 Schema.org FAQPage)
 * 3. sitemap.xml & robots.txt (Google 搜尋引擎索引名冊)
 */

const fs = require('fs');
const path = require('path');
const { CATEGORIES, TOPICS } = require('../lib/topics-data.cjs');

const BASE_URL = 'https://taiwan-pt-web.vercel.app';
const TOPICS_DIR = path.join(__dirname, '../topics');

if (!fs.existsSync(TOPICS_DIR)) {
  fs.mkdirSync(TOPICS_DIR, { recursive: true });
}

// ── HTML 安全編碼工具 ───────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── 智能關聯推薦運算（同部位、關鍵字重疊度評分） ────────
function getRelatedTopics(currentTopic, allTopics) {
  const sameCat = allTopics.filter(t => t.category === currentTopic.category && t.slug !== currentTopic.slug);
  const currentTokens = (currentTopic.keyword + ' ' + currentTopic.title).split(/[,、\s]+/);

  const scored = sameCat.map(t => {
    let score = 0;
    const targetText = t.title + ' ' + t.keyword + ' ' + t.description;
    currentTokens.forEach(token => {
      if (token.length >= 2 && targetText.includes(token)) {
        score += 2;
      }
    });
    return { topic: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, 3).map(s => s.topic);

  // 若不足 3 篇，以同分類其他題目補足
  if (result.length < 3) {
    for (const t of sameCat) {
      if (!result.some(r => r.slug === t.slug)) {
        result.push(t);
        if (result.length === 3) break;
      }
    }
  }
  return result;
}

// ── 1. 產生 104 篇個別 SEO 專題頁面 ─────────────────────
TOPICS.forEach((topic) => {
  const cat = CATEGORIES[topic.category] || { name: '肌骨健康', icon: '🩺' };
  const pageUrl = `${BASE_URL}/topics/${topic.slug}`;
  const relatedTopics = getRelatedTopics(topic, TOPICS);

  // Schema.org FAQPage
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': (topic.faq || []).map(item => ({
      '@type': 'Question',
      'name': item.q,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': item.a
      }
    }))
  };

  // Schema.org MedicalWebPage
  const medicalSchema = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    'name': topic.title,
    'description': topic.description,
    'url': pageUrl,
    'about': {
      '@type': 'MedicalCondition',
      'name': topic.shortName,
      'possibleTreatment': (topic.selfCare || []).map(act => ({
        '@type': 'PhysicalTherapy',
        'name': act
      }))
    }
  };

  // Schema.org Breadcrumbs
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': '首頁', 'item': BASE_URL },
      { '@type': 'ListItem', 'position': 2, 'name': '實證疼痛百科', 'item': `${BASE_URL}/topics/` },
      { '@type': 'ListItem', 'position': 3, 'name': cat.name, 'item': `${BASE_URL}/topics/#${topic.category}` },
      { '@type': 'ListItem', 'position': 4, 'name': topic.shortName, 'item': pageUrl }
    ]
  };

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(topic.title)} | 臺灣物理治療實證助手</title>
  <meta name="description" content="${escapeHtml(topic.description)}">
  <meta name="keywords" content="${escapeHtml(topic.keyword)}">
  <meta name="google-site-verification" content="4FE8VjPYT4NzDNajbYPiakW30hZDkauPCJ14JmDDrEo">
  <link rel="canonical" href="${pageUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(topic.title)} | 臺灣物理治療實證助手">
  <meta property="og:description" content="${escapeHtml(topic.description)}">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="臺灣物理治療實證助手">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(topic.title)}">
  <meta name="twitter:description" content="${escapeHtml(topic.description)}">

  <!-- Favicon & PWA -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🩺</text></svg>">
  <meta name="theme-color" content="#007AFF" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1C1C1E" media="(prefers-color-scheme: dark)">

  <!-- JSON-LD Structured Data (Google SEO & AI Overview) -->
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(medicalSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>

  <style>
    :root {
      --bg: #F2F2F7;
      --card-bg: #FFFFFF;
      --text-main: #1C1C1E;
      --text-muted: #8E8E93;
      --primary: #007AFF;
      --primary-light: rgba(0, 122, 255, 0.08);
      --red-bg: #FFF2F2;
      --red-border: #FF3B30;
      --red-text: #D70015;
      --green-bg: #F2FBF5;
      --green-border: #34C759;
      --green-text: #248A3D;
      --font-zh: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang TC", "Hiragino Sans GB", "Microsoft JhengHei", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #000000;
        --card-bg: #1C1C1E;
        --text-main: #F2F2F7;
        --text-muted: #98989D;
        --primary: #0A84FF;
        --primary-light: rgba(10, 132, 255, 0.15);
        --red-bg: #2C1515;
        --red-border: #FF453A;
        --red-text: #FF6961;
        --green-bg: #122818;
        --green-border: #30D158;
        --green-text: #30D158;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-zh);
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 4rem;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 1.25rem 1rem;
    }
    .top-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--primary);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.4rem 0.8rem;
      border-radius: 0.6rem;
      background: var(--primary-light);
    }
    .nav-btn:hover { opacity: 0.85; }
    .breadcrumbs {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }
    .breadcrumbs a {
      color: var(--text-muted);
      text-decoration: none;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--primary);
      background: var(--primary-light);
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      margin-bottom: 0.6rem;
    }
    h1 {
      font-size: 1.45rem;
      font-weight: 800;
      line-height: 1.35;
      margin-bottom: 0.85rem;
      color: var(--text-main);
    }
    .intro-card {
      background: var(--card-bg);
      border-radius: 1rem;
      padding: 1.1rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.04);
      font-size: 0.94rem;
    }
    .section-card {
      background: var(--card-bg);
      border-radius: 1rem;
      padding: 1.15rem;
      margin-bottom: 1rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.04);
    }
    .section-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .red-card {
      background: var(--red-bg);
      border-left: 4px solid var(--red-border);
    }
    .red-card .section-title { color: var(--red-text); }
    .green-card {
      background: var(--green-bg);
      border-left: 4px solid var(--green-border);
    }
    .green-card .section-title { color: var(--green-text); }
    ul { list-style: none; }
    li {
      position: relative;
      padding-left: 1.35rem;
      margin-bottom: 0.6rem;
      font-size: 0.92rem;
    }
    li::before {
      content: "•";
      position: absolute;
      left: 0.35rem;
      color: var(--text-muted);
      font-weight: 700;
    }
    .faq-item {
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .faq-item:last-child { border-bottom: none; }
    .faq-q {
      font-weight: 700;
      font-size: 0.92rem;
      margin-bottom: 0.3rem;
      color: var(--text-main);
    }
    .faq-a {
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.55;
    }

    /* ── 延伸相關專題推薦網 ── */
    .related-section {
      margin-top: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .related-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.75rem;
    }
    .related-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .related-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .related-grid {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .related-card {
      background: var(--card-bg);
      border-radius: 0.85rem;
      padding: 0.9rem 1rem;
      text-decoration: none;
      color: var(--text-main);
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
      border: 1px solid rgba(0,0,0,0.05);
      transition: transform 0.15s ease, border-color 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .related-card:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
    }
    .related-card-badge {
      font-weight: 700;
      font-size: 0.92rem;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .related-card-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .related-card-arrow {
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--primary);
      text-align: right;
      margin-top: 0.1rem;
    }

    /* ── CTA Action Bar ── */
    .cta-container {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .cta-btn-ai {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: var(--primary);
      color: #FFFFFF;
      text-decoration: none;
      padding: 0.9rem 1.25rem;
      border-radius: 0.85rem;
      font-weight: 700;
      font-size: 0.98rem;
      box-shadow: 0 4px 14px rgba(0, 122, 255, 0.3);
      transition: transform 0.15s ease;
    }
    .cta-btn-ai:hover { transform: scale(0.99); }
    .cta-btn-share-line {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #06C755;
      color: #FFFFFF;
      text-decoration: none;
      padding: 0.85rem 1.25rem;
      border-radius: 0.85rem;
      font-weight: 700;
      font-size: 0.94rem;
      box-shadow: 0 4px 12px rgba(6, 199, 85, 0.25);
      transition: transform 0.15s ease;
    }
    .cta-btn-share-line:hover { transform: scale(0.99); }
    .cta-btn-line {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: transparent;
      border: 1px solid rgba(0,0,0,0.12);
      color: var(--text-main);
      text-decoration: none;
      padding: 0.75rem 1.25rem;
      border-radius: 0.85rem;
      font-weight: 600;
      font-size: 0.88rem;
    }
    @media (prefers-color-scheme: dark) {
      .cta-btn-line { border-color: rgba(255,255,255,0.18); }
    }
    .footer-disclaimer {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 2rem;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Top Navigation -->
    <div class="top-nav">
      <a href="/" class="nav-btn">← 回到 AI 實證助手</a>
      <a href="/topics/" class="nav-btn">📚 全部百大專題</a>
    </div>

    <!-- Breadcrumbs -->
    <div class="breadcrumbs">
      <a href="/">首頁</a> &gt; <a href="/topics/">百大實證百科</a> &gt; <span>${escapeHtml(cat.name)}</span>
    </div>

    <!-- Title Header -->
    <div class="badge">${cat.icon} ${escapeHtml(cat.name)}</div>
    <h1>${escapeHtml(topic.title)}</h1>

    <!-- Summary Intro -->
    <div class="intro-card">
      ${escapeHtml(topic.description)}
    </div>

    <!-- 1. 紅旗警訊 -->
    <div class="section-card red-card">
      <div class="section-title">🚨 何時應立即就醫（危險警訊紅旗）</div>
      <ul>
        ${topic.redFlags.map(rf => `<li>${escapeHtml(rf)}</li>`).join('\n        ')}
      </ul>
    </div>

    <!-- 2. 常見症狀 -->
    <div class="section-card">
      <div class="section-title">🩺 常見典型症狀表現</div>
      <ul>
        ${topic.symptoms.map(sym => `<li>${escapeHtml(sym)}</li>`).join('\n        ')}
      </ul>
    </div>

    <!-- 3. 物理治療自我舒緩 -->
    <div class="section-card green-card">
      <div class="section-title">💡 物理治療自我舒緩與動作指引</div>
      <ul>
        ${topic.selfCare.map(sc => `<li>${escapeHtml(sc)}</li>`).join('\n        ')}
      </ul>
    </div>

    <!-- 4. 應避免動作 -->
    <div class="section-card">
      <div class="section-title">🚫 日常應盡量避免之危險動作</div>
      <ul>
        ${topic.avoidActions.map(aa => `<li>${escapeHtml(aa)}</li>`).join('\n        ')}
      </ul>
    </div>

    <!-- 5. 常見問答 FAQ -->
    ${topic.faq && topic.faq.length > 0 ? `
    <div class="section-card">
      <div class="section-title">❓ 常見疑惑與臨床 Q&amp;A</div>
      ${topic.faq.map(item => `
      <div class="faq-item">
        <div class="faq-q">Q: ${escapeHtml(item.q)}</div>
        <div class="faq-a">${escapeHtml(item.a)}</div>
      </div>
      `).join('\n      ')}
    </div>
    ` : ''}

    <!-- 相關實證推薦專題（內部連結網絡） -->
    <div class="related-section">
      <div class="related-header">
        <span class="related-title">📚 延伸閱讀：相關實證專題</span>
        <span class="related-sub">同部位動作與避險指引</span>
      </div>
      <div class="related-grid">
        ${relatedTopics.map(rel => {
          const relCat = CATEGORIES[rel.category] || { icon: '🩺' };
          return `
        <a href="/topics/${rel.slug}" class="related-card">
          <div class="related-card-badge">${relCat.icon} ${escapeHtml(rel.shortName)}</div>
          <div class="related-card-desc">${escapeHtml(rel.description)}</div>
          <div class="related-card-arrow">閱讀指引 ➔</div>
        </a>`;
        }).join('\n')}
      </div>
    </div>

    <!-- 雙向導流呼叫行動 -->
    <div class="cta-container">
      <a href="/?q=${encodeURIComponent(topic.title)}" class="cta-btn-ai">
        💬 與 AI 治療師一對一客製諮詢此症狀 ➔
      </a>
      <a href="https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(`【常見疼痛實證百科】${topic.title}\n\n${topic.description}\n\n完整動作與避險指引：`)}" target="_blank" rel="noopener" class="cta-btn-share-line">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M24 10.3c0-4.8-5.4-8.8-12-8.8S0 5.5 0 10.3c0 4.3 3.8 8 9.3 8.7.4.1.9.3 1 .6.1.4 0 .9-.1 1.4l-.4 2.3c-.1.7-.4 2.7 1.2 1.5 1.6-1.2 8.6-5.1 11.7-8.7 1-1.6 1.3-3.6 1.3-5.5z"/>
        </svg>
        <span>分享這篇實證指南給 LINE 好友 / 群組</span>
      </a>
      <a href="https://lin.ee/y6VBRuh" target="_blank" rel="noopener" class="cta-btn-line">
        預約物理治療師一對一評估諮詢 ↗
      </a>
    </div>

    <div class="footer-disclaimer">
      本百科內容依據國際醫學臨床指引與文獻整理，僅供衛生教育與動作參考，無法取代實體醫療診斷與治療。
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(TOPICS_DIR, `${topic.slug}.html`), html, 'utf8');
});
console.log(`✅ 成功產出全部 ${TOPICS.length} 篇靜態專題 HTML！`);

// ── 2. 產生 topics/index.html 百科目錄中心 ───────────────
const indexHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>百大常見疼痛與肌骨問題實證百科 | 臺灣物理治療實證助手</title>
  <meta name="description" content="全台灣百大常見疼痛、肌肉拉傷、關節退化與辦公人體工學實證百科目錄。由物理治療團隊依據國際醫學臨床指引建立。">
  <meta name="google-site-verification" content="4FE8VjPYT4NzDNajbYPiakW30hZDkauPCJ14JmDDrEo">
  <link rel="canonical" href="${BASE_URL}/topics/">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>">
  <meta name="theme-color" content="#007AFF" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1C1C1E" media="(prefers-color-scheme: dark)">

  <style>
    :root {
      --bg: #F2F2F7;
      --card-bg: #FFFFFF;
      --text-main: #1C1C1E;
      --text-muted: #8E8E93;
      --primary: #007AFF;
      --primary-light: rgba(0, 122, 255, 0.08);
      --font-zh: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang TC", "Microsoft JhengHei", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #000000;
        --card-bg: #1C1C1E;
        --text-main: #F2F2F7;
        --text-muted: #98989D;
        --primary: #0A84FF;
        --primary-light: rgba(10, 132, 255, 0.15);
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-zh);
      background: var(--bg);
      color: var(--text-main);
      line-height: 1.5;
      padding-bottom: 4rem;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 1.25rem 1rem;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .back-btn {
      color: var(--primary);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      background: var(--primary-light);
      padding: 0.4rem 0.8rem;
      border-radius: 0.6rem;
    }
    h1 {
      font-size: 1.45rem;
      font-weight: 800;
      margin-bottom: 0.4rem;
    }
    .subtitle {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin-bottom: 1.25rem;
    }
    .search-box {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 0.85rem;
      border: 1px solid rgba(0,0,0,0.1);
      font-size: 0.95rem;
      background: var(--card-bg);
      color: var(--text-main);
      outline: none;
      margin-bottom: 1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .filter-pills {
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
      margin-bottom: 1.25rem;
      -webkit-overflow-scrolling: touch;
    }
    .pill {
      white-space: nowrap;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
      background: var(--card-bg);
      color: var(--text-main);
      border: 1px solid rgba(0,0,0,0.08);
      cursor: pointer;
    }
    .pill.active {
      background: var(--primary);
      color: #FFFFFF;
      border-color: var(--primary);
    }
    .category-block {
      margin-bottom: 2rem;
    }
    .cat-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .topics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 0.75rem;
    }
    .topic-card {
      background: var(--card-bg);
      border-radius: 0.9rem;
      padding: 1rem;
      text-decoration: none;
      color: var(--text-main);
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
      border: 1px solid rgba(0,0,0,0.05);
      transition: transform 0.15s ease, border-color 0.15s ease;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .topic-card:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
    }
    .card-title {
      font-weight: 700;
      font-size: 0.96rem;
      margin-bottom: 0.35rem;
      color: var(--text-main);
    }
    .card-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.45;
      margin-bottom: 0.6rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: var(--primary);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-header">
      <a href="/" class="back-btn">← 回到 AI 實證對話助手</a>
      <a href="https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Ftaiwan-pt-web.vercel.app%2Ftopics%2F&text=%E3%80%90%E5%8F%B0%E7%81%A3%E7%89%A9%E7%90%86%E6%B2%BB%E7%99%82%E5%AF%A6%E8%AD%89%E7%99%BE%E7%A7%91%E3%80%91%E6%94%B6%E9%8C%84%E5%85%A8%E5%8F%B0%20104%20%E5%A4%A7%E5%B8%B8%E8%A6%8B%E7%96%BC%E7%97%9B%E3%80%81%E5%A7%BF%E5%8B%A2%E8%88%87%E9%81%8B%E5%8B%95%E5%A1%9E%E8%AD%B7%E6%8C%87%E5%BC%95%EF%BC%8C%E9%BB%9E%E6%AD%A4%E9%80%B2%E5%85%A5%E6%9F%A5%E8%A9%A2%EF%BC%9A" target="_blank" rel="noopener" class="back-btn" style="background:#06C755; color:#FFFFFF; display:inline-flex; align-items:center; gap:0.35rem;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M24 10.3c0-4.8-5.4-8.8-12-8.8S0 5.5 0 10.3c0 4.3 3.8 8 9.3 8.7.4.1.9.3 1 .6.1.4 0 .9-.1 1.4l-.4 2.3c-.1.7-.4 2.7 1.2 1.5 1.6-1.2 8.6-5.1 11.7-8.7 1-1.6 1.3-3.6 1.3-5.5z"/>
        </svg>
        <span>LINE 分享百科</span>
      </a>
    </div>

    <h1>百大常見疼痛與肌骨實證百科</h1>
    <div class="subtitle">依據國際臨床指引與醫學文獻，提供一般民眾最安心清晰的動作衛教指南</div>

    <input type="text" id="searchInput" class="search-box" placeholder="🔍 搜尋症狀（例：久坐腰痛、膝蓋、足底、富貴包…）" oninput="filterTopics()">

    <div class="filter-pills">
      <button class="pill active" onclick="setCategory('all', this)">全部 (${TOPICS.length})</button>
      ${Object.entries(CATEGORIES).map(([catKey, cat]) => {
        const count = TOPICS.filter(t => t.category === catKey).length;
        return `<button class="pill" onclick="setCategory('${catKey}', this)">${cat.icon} ${cat.name} (${count})</button>`;
      }).join('\n      ')}
    </div>

    <div id="topicsContainer">
      ${Object.entries(CATEGORIES).map(([catKey, cat]) => {
        const catTopics = TOPICS.filter(t => t.category === catKey);
        return `
        <div class="category-block" data-cat="${catKey}">
          <div class="cat-title">${cat.icon} ${cat.name}</div>
          <div class="topics-grid">
            ${catTopics.map(t => `
            <a href="/topics/${t.slug}" class="topic-card" data-title="${escapeHtml(t.title)}" data-keywords="${escapeHtml(t.keyword)}">
              <div>
                <div class="card-title">${escapeHtml(t.shortName)}</div>
                <div class="card-desc">${escapeHtml(t.description)}</div>
              </div>
              <div class="card-footer">
                <span>實證衛教指引</span>
                <span>閱讀專題 ➔</span>
              </div>
            </a>
            `).join('\n            ')}
          </div>
        </div>
        `;
      }).join('\n      ')}
    </div>
  </div>

  <script>
    let currentCat = 'all';

    function setCategory(cat, btn) {
      currentCat = cat;
      document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      filterTopics();
    }

    function filterTopics() {
      const q = document.getElementById('searchInput').value.trim().toLowerCase();
      const blocks = document.querySelectorAll('.category-block');

      blocks.forEach(block => {
        const blockCat = block.getAttribute('data-cat');
        const catMatch = (currentCat === 'all' || currentCat === blockCat);
        const cards = block.querySelectorAll('.topic-card');
        let hasVisibleCard = false;

        cards.forEach(card => {
          const title = (card.getAttribute('data-title') || '').toLowerCase();
          const kw = (card.getAttribute('data-keywords') || '').toLowerCase();
          const textMatch = (!q || title.includes(q) || kw.includes(q));

          if (catMatch && textMatch) {
            card.style.display = 'flex';
            hasVisibleCard = true;
          } else {
            card.style.display = 'none';
          }
        });

        block.style.display = hasVisibleCard ? 'block' : 'none';
      });
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(TOPICS_DIR, 'index.html'), indexHtml, 'utf8');
console.log('✅ 成功產出 topics/index.html 百科目錄中心！');

// ── 3. 產生 sitemap.xml 與 robots.txt ─────────────────────
const now = new Date().toISOString().split('T')[0];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/topics/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${TOPICS.map(t => `  <url>
    <loc>${BASE_URL}/topics/${t.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync(path.join(__dirname, '../sitemap.xml'), sitemapXml, 'utf8');
console.log(`✅ 成功產出 sitemap.xml，共包含 ${TOPICS.length + 2} 個索引網址！`);

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
fs.writeFileSync(path.join(__dirname, '../robots.txt'), robotsTxt, 'utf8');
console.log('✅ 成功產出 robots.txt');

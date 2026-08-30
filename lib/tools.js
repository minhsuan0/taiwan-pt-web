/**
 * lib/tools.js
 * 直接包含物理治療查詢工具邏輯（從 taiwan-pt-mcp 移植）
 * 供 Vercel Functions 直接調用，無需 MCP stdio 協定
 */

const PUBMED_ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

// ─── HTTP helper ────────────────────────────────────────────────────────────
async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TaiwanPT-Web/1.0 (mailto:pt@example.com)' },
    signal: AbortSignal.timeout(3500),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function truncate(text, max = 300) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function fmtAuthors(authors, max = 2) {
  if (!authors?.length) return '';
  const names = authors.slice(0, max).map(a => a.name);
  if (authors.length > max) names.push(`et al.`);
  return names.join(', ');
}

// ─── 靜態解剖詞典 ─────────────────────────────────────────────────────────
const ANATOMY_DICT = {
  'rotator cuff': { zh: '旋轉肌群', func: '穩定肱骨頭於關節盂內；棘上肌外展 0–15°，棘下肌/小圓肌外旋，肩胛下肌內旋。', nerve: '腋神經（C5–C6）、肩胛上神經（C5–C6）', clinical: '疼痛弧 60–120°、Neer/Hawkins 陽性；完全撕裂 Drop Arm Test 陽性。' },
  '棘上肌': { zh: '棘上肌（Supraspinatus）', func: '肩外展初始 0–15°，協助肱骨頭下壓防夾擠。', nerve: '肩胛上神經（C5–C6）', clinical: '最常見旋轉肌群損傷，空罐測試（Empty Can Test）陽性。' },
  'gluteus medius': { zh: '臀中肌', func: '髖外展、內旋；步態站立相骨盆穩定關鍵。', nerve: '臀上神經（L4–S1）', clinical: '無力 → Trendelenburg 步態 → 髂脛束症候群、膝外翻風險增加。' },
  '臀中肌': { zh: '臀中肌（Gluteus Medius）', func: '髖外展、內旋；步態站立相骨盆穩定關鍵。', nerve: '臀上神經（L4–S1）', clinical: '無力 → Trendelenburg 步態；與髂脛束症候群、下背痛、PFPS 相關。' },
  'anterior cruciate ligament': { zh: '前十字韌帶（ACL）', func: '限制脛骨前移、防止膝過伸、協助旋轉穩定。', nerve: '關節神經（本體感覺豐富）', clinical: 'Lachman test（敏感性最高）、前抽屜測試、Pivot Shift test。' },
  '前十字韌帶': { zh: '前十字韌帶（ACL）', func: '限制脛骨前移、防止膝過伸、協助旋轉穩定。', nerve: '關節神經（本體感覺豐富）', clinical: 'Lachman test、前抽屜測試、Pivot Shift test 評估完整性。' },
  'lumbar spine': { zh: '腰椎（L1–L5）', func: '承重、前屈（主要）、後伸、側屈、有限旋轉。', nerve: '腰神經根 L1–L5', clinical: '紅旗：馬尾症候群（大小便失禁須緊急手術）。SLR 測試 L4–S1 神經根。' },
  '腰椎': { zh: '腰椎（L1–L5）', func: '承重、前屈（主要）、後伸、側屈、有限旋轉。', nerve: '腰神經根 L1–L5', clinical: '紅旗徵兆：馬尾症候群（大小便失禁須緊急轉診）。SLR 測試。' },
  'quadriceps': { zh: '股四頭肌', func: '伸膝（主要）；股直肌亦協助屈髖。VMO 在末期伸直扮演重要角色。', nerve: '股神經（L2–L4）', clinical: 'VMO 不足 → 髕骨外移 → PFPS；ACL 重建後股四頭肌恢復是復健指標。' },
  'shoulder': { zh: '肩複合體', func: '盂肱節律 2:1（肩外展 180° = GH 120° + 肩胛骨 60° 上旋）。', nerve: 'C5–C6（外展）', clinical: '肩峰下夾擠：Hawkins/Kennedy；肩不穩：恐懼測試；AC 分離：壓痛。' },
  'knee': { zh: '膝關節', func: '主要屈伸；終端外旋鎖定伸直位（screw home mechanism）。', nerve: '股神經、坐骨神經、閉孔神經', clinical: 'PFPS：Clarke；半月板：McMurray；PCL：後抽屜；MCL：外翻應力。' },
};

// 靜態法規
const PT_LAW = {
  '業務': ['第12條：應依醫師診斷或醫囑提供物理治療評估及治療。', '第13條：業務範圍包括評估測試、電熱光水冷機械治療、運動訓練、輔具評估。'],
  '診斷': ['第12條：應依醫師診斷或醫囑執行業務。', '第14條：物理治療師不得為醫療診斷。'],
  '醫囑': ['第12條：應依醫師開具之診斷或醫囑，提供物理治療評估及治療。'],
  '範圍': ['第13條：評估測試、電熱光水冷機械治療、運動及運動訓練、輔具評估及使用訓練。', '第14條：不得為醫療診斷，業務以物理治療評估與治療為限。'],
  '執業': ['第24條：不得同時在兩所以上機構執業，但機構間支援協助不在此限。'],
  '資格': ['第1條：經物理治療師考試及格並領有證書者，得充物理治療師。'],
};

// ─── 醫學中英對照詞典（提升 PubMed 搜尋命中率）──────────────────────────────
const MED_EN_MAP = [
  { zh: /前十字韌帶|前十字|acl/i, en: 'anterior cruciate ligament ACL' },
  { zh: /後十字韌帶|後十字|pcl/i, en: 'posterior cruciate ligament PCL' },
  { zh: /半月板/i, en: 'meniscus meniscal tear' },
  { zh: /旋轉肌|棘上肌|肩袖|肩關節|肩/i, en: 'rotator cuff shoulder' },
  { zh: /五十肩|冰凍肩|沾黏性肩關節囊炎/i, en: 'adhesive capsulitis frozen shoulder' },
  { zh: /夾擠|肩夾擠/i, en: 'shoulder impingement subacromial' },
  { zh: /網球肘|外上髁/i, en: 'lateral epicondylitis tennis elbow' },
  { zh: /高爾夫球肘|內上髁/i, en: 'medial epicondylitis golfer elbow' },
  { zh: /媽媽手|狄奎凡/i, en: 'de Quervain tenosynovitis' },
  { zh: /腕隧道/i, en: 'carpal tunnel syndrome' },
  { zh: /下背痛|腰痛|腰椎|腰部|閃腰/i, en: 'low back pain lumbar spine' },
  { zh: /椎間盤突出|椎間盤|hivd/i, en: 'lumbar disc herniation radiculopathy' },
  { zh: /坐骨神經|梨狀肌/i, en: 'sciatica piriformis syndrome' },
  { zh: /薦髂關節|髂骨|骨盆/i, en: 'sacroiliac joint pelvic pain' },
  { zh: /頸椎|落枕|脖子|頸部/i, en: 'cervical spine neck pain' },
  { zh: /退化性關節炎|退化性膝關節|骨關節炎/i, en: 'knee osteoarthritis' },
  { zh: /髕骨|髕骨股骨|pfps|膝蓋/i, en: 'patellofemoral pain syndrome knee' },
  { zh: /髂脛束|itb/i, en: 'iliotibial band syndrome' },
  { zh: /足底筋膜|腳底痛/i, en: 'plantar fasciitis' },
  { zh: /跟腱|阿基里斯/i, en: 'achilles tendinopathy tendon' },
  { zh: /踝扭傷|腳踝|翻船/i, en: 'ankle sprain lateral ligament' },
  { zh: /離心|離心收縮|離心運動/i, en: 'eccentric exercise muscle contraction tendinopathy' },
  { zh: /向心|向心收縮/i, en: 'concentric contraction exercise' },
  { zh: /等長|等長收縮/i, en: 'isometric contraction exercise' },
  { zh: /深蹲|下蹲/i, en: 'squat biomechanics knee' },
  { zh: /硬舉/i, en: 'deadlift lumbar hip mechanics' },
  { zh: /跑步|路跑/i, en: 'running injury biomechanics' },
  { zh: /核心|核心訓練|穩定/i, en: 'core stability exercise lumbar' },
  { zh: /伸展|拉筋/i, en: 'stretching flexibility' },
  { zh: /肌力|強化|阻力/i, en: 'strengthening resistance training' },
  { zh: /徒手治療|關節鬆動/i, en: 'manual therapy joint mobilization' },
  { zh: /術後|手術|重建/i, en: 'postoperative rehabilitation reconstruction' },
];

function translateToEnglishMedicalQuery(query) {
  if (!query) return 'physical therapy rehabilitation';
  const matched = [];
  for (const item of MED_EN_MAP) {
    if (item.zh.test(query)) {
      matched.push(item.en);
    }
  }
  // 若有匹配到英文醫學詞，以匹配詞為主；若本身已有英文單字也保留
  const englishWords = query.match(/[a-zA-Z]{3,}/g) ?? [];
  const combined = [...new Set([...matched, ...englishWords])];
  return combined.length > 0 ? combined.join(' ') : 'physical therapy rehabilitation exercise';
}

// ─── Tool 1: search_pedro_evidence ─────────────────────────────────────────
export async function searchPedroEvidence(query, maxResults = 5) {
  const enQuery = translateToEnglishMedicalQuery(query);
  const fullQuery = `(${enQuery}) AND (physical therapy OR physiotherapy OR rehabilitation) AND (randomized controlled trial[pt] OR systematic review[pt] OR meta-analysis[pt])`;
  const pedroUrl = `https://pedro.org.au/english/search/?keyword=${encodeURIComponent(enQuery)}&search=Search`;
  try {
    const sd = await getJson(`${PUBMED_ESEARCH}?db=pubmed&term=${encodeURIComponent(fullQuery)}&retmax=${maxResults}&retmode=json&sort=relevance`);
    const ids = sd.esearchresult?.idlist ?? [];
    if (!ids.length) return { source: 'PubMed', results: [], warning: `查無結果，請至 PEDro 查詢：${pedroUrl}` };
    const sum = await getJson(`${PUBMED_ESUMMARY}?db=pubmed&id=${ids.join(',')}&retmode=json`);
    const results = ids.map(pmid => {
      const a = sum.result[pmid];
      if (!a) return null;
      const doi = a.elocationid?.startsWith('10.') ? a.elocationid.replace(/^doi:\s*/i, '') : null;
      return { title: truncate(a.title, 200), authors: fmtAuthors(a.authors), year: parseInt(a.pubdate) || null, journal: a.fulljournalname ?? a.source, url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, doi };
    }).filter(Boolean);
    return { source: 'PubMed（RCT/SR/MA）', results, warning: `PEDro 完整評分請至：${pedroUrl}` };
  } catch (e) {
    return { source: 'PubMed', results: [], error: e.message };
  }
}

// ─── Tool 2: search_cpg_guidelines ─────────────────────────────────────────
export async function searchCpgGuidelines(condition, bodyRegion, maxResults = 5) {
  const enCondition = translateToEnglishMedicalQuery(condition);
  const enRegion = translateToEnglishMedicalQuery(bodyRegion);
  const q = `(${enCondition}) AND (${enRegion}) AND (clinical practice guideline OR CPG OR guideline) AND (physical therapy OR physiotherapy OR rehabilitation)`;
  try {
    const sd = await getJson(`${PUBMED_ESEARCH}?db=pubmed&term=${encodeURIComponent(q)}&retmax=${maxResults}&retmode=json&sort=relevance`);
    const ids = sd.esearchresult?.idlist ?? [];
    if (!ids.length) return { source: 'PubMed CPG', results: [], warning: '查無結果，請至 https://www.twpta.org.tw/ 查詢台灣物理治療學會指南。' };
    const sum = await getJson(`${PUBMED_ESUMMARY}?db=pubmed&id=${ids.join(',')}&retmode=json`);
    const results = ids.map(pmid => {
      const a = sum.result[pmid];
      if (!a) return null;
      const doi = a.elocationid?.startsWith('10.') ? a.elocationid.replace(/^doi:\s*/i, '') : null;
      return { title: truncate(a.title, 200), authors: fmtAuthors(a.authors), year: parseInt(a.pubdate) || null, journal: a.fulljournalname ?? a.source, url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
    }).filter(Boolean);
    return { source: 'PubMed 臨床指南（CPG）', results, refs: ['台灣物理治療學會: https://www.twpta.org.tw/', 'APTA CPG: https://www.apta.org/'] };
  } catch (e) {
    return { source: 'PubMed CPG', results: [], error: e.message };
  }
}

// ─── Tool 3: search_pt_laws ─────────────────────────────────────────────────
export async function searchPtLaws(keyword) {
  const matched = Object.entries(PT_LAW)
    .filter(([k]) => keyword.includes(k))
    .flatMap(([, v]) => v);
  const unique = [...new Set(matched)];
  const results = unique.length
    ? unique.map(text => ({ title: `《物理治療師法》${text.split('：')[0]}`, content: text }))
    : [
        { title: '第12條 — 執業依據', content: '應依醫師開具之診斷或醫囑，提供物理治療評估及治療。' },
        { title: '第13條 — 業務範圍', content: '評估測試、電熱光水冷機械治療、運動訓練、輔具評估使用訓練。' },
        { title: '第14條 — 禁止診斷', content: '物理治療師不得為醫療診斷，業務以物理治療評估與治療為限。' },
      ];
  return { source: '台灣《物理治療師法》', results, url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020003' };
}

// ─── Tool 4: search_anatomy_biomechanics ───────────────────────────────────
export async function searchAnatomyBiomechanics(muscleOrJoint, maxResults = 3) {
  const key = Object.keys(ANATOMY_DICT).find(k =>
    muscleOrJoint.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(muscleOrJoint.toLowerCase())
  );
  const staticResult = key ? [{
    title: `解剖定義：${ANATOMY_DICT[key].zh}`,
    content: `【功能】${ANATOMY_DICT[key].func}\n【神經支配】${ANATOMY_DICT[key].nerve}\n【臨床意義】${ANATOMY_DICT[key].clinical}`,
  }] : [];

  let pubmedResults = [];
  try {
    const enJoint = translateToEnglishMedicalQuery(muscleOrJoint);
    const q = `(${enJoint}) AND (anatomy OR biomechanics OR kinesiology) AND (physical therapy OR physiotherapy)`;
    const sd = await getJson(`${PUBMED_ESEARCH}?db=pubmed&term=${encodeURIComponent(q)}&retmax=${maxResults}&retmode=json`);
    const ids = sd.esearchresult?.idlist ?? [];
    if (ids.length) {
      const sum = await getJson(`${PUBMED_ESUMMARY}?db=pubmed&id=${ids.join(',')}&retmode=json`);
      pubmedResults = ids.map(pmid => {
        const a = sum.result[pmid];
        if (!a) return null;
        const doi = a.elocationid?.startsWith('10.') ? a.elocationid.replace(/^doi:\s*/i, '') : null;
        return { title: truncate(a.title, 180), journal: a.fulljournalname ?? a.source, year: parseInt(a.pubdate) || null, url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
      }).filter(Boolean);
    }
  } catch { /* 離線時靜態詞典已可使用 */ }

  return {
    source: '解剖生物力學資料庫',
    staticDefinition: staticResult,
    pubmedResults,
    warning: '⚠️ 解剖資訊供臨床參考，評估前請結合個別患者身體檢查。'
  };
}


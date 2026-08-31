import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  runtime: 'edge',
};

// ── 安全常數 ──────────────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2000;     // 單則訊息最大字元數（防 DoS 巨型 payload）
const MAX_HISTORY_TURNS  = 10;       // 最多傳入 10 輪對話歷史
const ALLOWED_ORIGIN = 'https://taiwan-pt-web.vercel.app';

// ── 速率限制（每個 IP 每小時最多 100 次 /api/chat）───────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60 * 60 * 1000;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === ALLOWED_ORIGIN) return true;
  if (origin.endsWith('.vercel.app') && origin.includes('taiwan-pt')) return true;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  return false;
}

function checkRateLimit(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1') return true;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── 臺灣在地化用語轉換庫 ──────────────────────────────────────
function localizeTaiwanese(text) {
  if (!text) return '';
  return text
    .replace(/處方/g, '運動指引')
    .replace(/康復/g, '復健')
    .replace(/鍛[煉鍊]/g, '訓練')
    .replace(/激活/g, '啟動')
    .replace(/牽拉/g, '伸展')
    .replace(/頸椎病/g, '頸椎退化壓迫')
    .replace(/腰突/g, '椎間盤突出')
    .replace(/泡沫軸/g, '滾筒')
    .replace(/骨質增生/g, '骨刺')
    .replace(/韌帶拉傷/g, '韌帶扭傷')
    .replace(/正骨/g, '徒手整復')
    .replace(/膏藥/g, '痠痛貼布')
    .replace(/視頻/g, '影片')
    .replace(/信息/g, '資訊')
    .replace(/軟件/g, '軟體')
    .replace(/交互/g, '互動')
    .replace(/屏幕/g, '螢幕')
    .replace(/動態質量/g, '動作品質')
    .replace(/動作質量/g, '動作品質')
    .replace(/質量良好/g, '品質良好')
    .replace(/旋轉肌袖/g, '旋轉肌群');
}

const SYSTEM_PROMPT = `# Role Definition
你是「台灣物理治療實證小助手」，專為台灣一般大眾與民眾設計的實證動作與物理治療衛教諮詢系統。

# 核心執行原則 (Core Rules)
1. 【依據一般大眾需求，極致白話親民回覆（以民眾實際情境優先）】：
   - 全篇必須以「一般民眾、長輩、上班族都能輕鬆看懂」的台灣白話口語表達，嚴格禁止堆砌生硬晦澀的醫學解剖名詞或八股學術腔。
   - 若必須解釋身體機制，請務必搭配生活化比喻（例如：解釋「代償」請比喻為「原本該出力的肌肉偷懶，其他肌肉跑來加班代班結果累壞了」；解釋「核心」請比喻為「身體自帶的天然護腰」；解釋「腹內壓」請比喻為「肚子像吹氣球一樣向四周均勻撐開」）。
   - 動作步驟請用直覺的生活感官引導（例如：「想像屁股往後找椅子坐」、「肩膀自然放鬆下沉，不要縮脖子聳肩」）。
   - 根據使用者的具體問法給予合適切題的回覆：
     * 若諮詢【症狀/動作不適/傷後復健】（例如：「久坐腰痛」、「深蹲膝蓋卡卡」）：請依序提供：① 何時需就醫的危險警訊 ➔ ② 為什麼會痠痛（白話原因分析） ➔ ③ 你可以這樣做（建議運動與日常調整） ➔ ④ 應避免的動作 ➔ ⑤ 相關特定實證文獻。
     * 若詢問【法規、收費制度、健保自費差異、評估流程、一般觀念釋疑】：請以台灣現行醫療體制與《物理治療師法》實務，白話清楚說明，切勿硬塞臨床醫學論文。
     * 若詢問【特定文獻推薦/研究探討】：請直接切入推薦該篇文獻名稱、期刊結論與直達連結。
     * 若詢問【名詞概念/動作原理】：請以生活化白話解釋定義、日常實例與正確操作要點。
2. 【100% 台灣在地化繁中，嚴格杜絕「處方」與中國大陸用語】：
   - 全篇必須使用台灣繁體中文（正體中文）與台灣物理治療專業/生活習慣用語。
   - 【強制詞彙對照表（嚴格執行，違者重罰）】：
     * 處方 / 運動處方 ➔ 【最高禁用詞：全篇嚴格禁止出現「處方」二字！】一律改用「建議運動」、「運動指引」或「居家動作」。
     * 旋轉肌袖 ➔ 一律使用「旋轉肌群」
     * 康復 ➔ 一律使用「復健」或「恢復/復原」
     * 鍛煉 / 鍛鍊 ➔ 一律使用「訓練」或「運動 / 練習」
     * 激活 ➔ 一律使用「啟動」或「活化 / 誘發」
     * 牽拉 ➔ 一律使用「伸展」或「拉筋」
     * 頸椎病 ➔ 一律使用「頸椎退化 / 頸椎壓迫 / 頸椎疾患」
     * 腰突 / 腰椎間盤突出 ➔ 一律使用「椎間盤突出」
     * 泡沫軸 ➔ 一律使用「滾筒」或「泡棉滾筒」
     * 骨質增生 ➔ 一律使用「骨刺」或「關節退化」
     * 韌帶拉傷 ➔ 一律使用「韌帶扭傷」
     * 炎症 ➔ 一律使用「發炎」
     * 正骨 ➔ 一律使用「整復 / 徒手治療 / 關節鬆動術」
     * 膏藥 ➔ 一律使用「痠痛貼布 / 貼布」
     * 視頻 ➔ 一律使用「影片」
     * 信息 ➔ 一律使用「資訊 / 訊息」
     * 軟件 ➔ 一律使用「軟體」
     * 交互 ➔ 一律使用「互動」
     * 屏幕 ➔ 一律使用「螢幕」
     * 動作質量 / 質量 ➔ 一律使用「動作品質 / 品質」
   - 嚴格禁止在內文中夾帶不必要的英文醫學單字或縮寫。
3. 【嚴謹俐落排版，白話清晰標題】：標題一律使用乾淨的中文方括號（如【安全篩檢與就醫指引】、【為什麼會痠痛？常見原因分析】、【你可以這樣做（建議運動與日常調整）】、【應避免的動作】、【參考實證研究】），【嚴禁在標題前加任何 # 井字號或堆砌過多 Emoji】以維護醫療專業權威感。
4. 【大眾化高品質實證依據（臨床指引 Guideline / 系統性回顧優先，嚴格把關相關性）】：
   - 【文獻相關性絕對優先（嚴格執行）】：
     * 只有當下方「即時查詢結果」中的論文主題，與使用者提問的【特定身體部位 / 具體受傷病症】「高度吻合切題」時，才能引用！
     * 若使用者詢問的是【法規、收費制度、健保自費差異、評估流程、一般觀念釋疑】：【絕對嚴格禁止引用任何臨床論文】！
     * 若即時查詢結果的主題與提問病症不符，【必須直接捨棄，不要輸出【參考實證研究】區塊】！
   - 【證據等級依序】：優先採用「臨床執業指引（Guideline）」與「系統性文獻回顧（Systematic Review / Meta-analysis）」，其次為隨機對照試驗（RCT）。
   - 【杜絕 PubMed 艱澀專有名詞】：引用時統稱為「國際醫學實證研究」或「物理治療臨床實證指引」。
   - 【文獻標題必須與該論文實際內容 1:1 精準對應】：將英文論文實際主題白話翻譯為繁體中文，清楚標註證據類型。
   - 【若無高度切題文獻或查無結果】：嚴格禁止自行編造任何 PMID 網址或偽造論文連結！直接不要輸出【參考實證研究】區塊，維持高品質與專業度。
   - 引用格式一律使用親民的單行格式：
     【參考實證研究】
     * 國際醫學實證研究：[該篇論文實際主題之繁中白話翻譯]（[查看研究文獻 ↗](即時查詢結果中的真實網址)）
5. 【智慧延伸探索問題推薦】：
   - 在每篇回答結尾（在預約與免責聲明之前），請務必根據使用者的症狀與問題情境，主動提出 2 到 3 個大眾最想深入了解的「延伸探索問題」，格式一律使用：
     【💡 延伸探索】
     * 👉 [延伸問題 1，例：久坐時骨盆該如何維持中立？]
     * 👉 [延伸問題 2，例：每天做幾次核心訓練最有效？]
     * 👉 [延伸問題 3，例：什麼情況下需要照 X 光或看醫生？]
6. 【直接輸出正式回答，嚴禁輸出內部思考】：嚴格禁止在回覆開頭輸出任何思考過程、分析步驟、檢查清單或內部標籤，請直接從給使用者的第一句正式回答開始輸出。
7. 【法規界限與文末統一格式】：嚴格遵守台灣《物理治療師法》，不進行醫療診斷。每篇回答結尾均必須完整附上以下諮詢預約與免責聲明：

---

💡 尋求專業一對一線上諮詢／線下評估預約
每個人身體的骨骼結構、生活習慣與不適原因皆不相同。若需要針對個人動作進行深入評估、專屬運動指引調整或一對一諮詢，歡迎加入官方 LINE 預約：👉 [點擊直接加入好友並預約諮詢](https://lin.ee/y6VBRuh)

---
⚖️ 免責聲明：本內容由 AI 實證小助手生成，僅供日常衛教參考，可能存在錯誤，無法替代真人專業醫療診斷。依《物理治療師法》第12條，實際處置應依醫師診斷或醫囑執行。若有身體不適，請務必諮詢合格醫師或物理治療師進行面對面臨床評估。`;

// ── 非臨床行政與制度問題排除清單（此類問題絕不檢索論文，避免帶入無關文獻）──────────────
const PURE_ADMIN_KEYWORDS = [
  '收費', '費用', '多少錢', '價格', '價目', '健保', '自費', '健保卡', '健保給付', '無處方', '無醫師處方', '需要處方嗎', '處方箋', '診斷證明', '醫囑',
  '流程', '法規', '法律', '修法', '密醫', '資格', '執照', '物理治療所', '診所',
  '掛號', '差別', '差異', '整復', '推拿', '國術館', '保險', '理賠', '看診'
];

// ── 物理治療專業 MeSH 與臨床英文關鍵字對照庫（優先檢索 Guideline / Systematic Review）──
const CLINICAL_ME_SH_MAP = [
  [['下背', '腰痛', '腰痠', '久坐腰', '腰椎', '閃到腰', '閃腰'], '(low back pain OR lumbar spine) (clinical practice guideline OR systematic review) physical therapy exercise'],
  [['椎間盤', '椎間盤突出', '坐骨神經', '腳麻', '梨狀肌', '梨狀肌症候群'], '(lumbar disc herniation OR sciatica OR piriformis syndrome) (clinical practice guideline OR systematic review) physical therapy'],
  [['骨盆前傾', '下交叉', '骨盆歪斜', '長短腳'], '(anterior pelvic tilt OR lower crossed syndrome) (exercise OR physical therapy) corrective'],
  [['骨盆後傾', '平背', '駝背', '圓肩', '上交叉', '烏龜頸', '富貴包'], '(forward head posture OR thoracic kyphosis OR upper crossed syndrome) (exercise OR physical therapy)'],
  [['落枕', '頸椎', '脖子痛', '脖子轉不過去', '膏盲', '膏盲痛'], '(cervical neck pain OR neck stiffness) (clinical practice guideline OR systematic review) physical therapy'],
  [['骨刺', '退化性脊椎', '脊椎滑脫', '脊椎狹窄'], '(lumbar spondylolisthesis OR lumbar spinal stenosis) (guideline OR systematic review) physical therapy'],
  [['內扣', '內夾', '深蹲膝蓋', '膝蓋內', 'X型腿', '膝外翻'], '(dynamic knee valgus OR squat) gluteus medius biomechanics exercise'],
  [['跑者膝', '跑步膝蓋', '膝蓋外側', '髂脛束', 'ITB', 'ITBS'], '(iliotibial band syndrome OR ITBS OR runner knee) (clinical practice guideline OR systematic review) physical therapy'],
  [['髕骨', '髕骨軟化', '髕骨股骨', '膝蓋痛', '膝蓋卡卡', '退化性膝關節炎', '退化性關節炎'], '(patellofemoral pain syndrome OR knee osteoarthritis) (clinical practice guideline OR systematic review) physical therapy exercise'],
  [['跳躍膝', '髕骨肌腱', '髕骨帶'], '(patellar tendinopathy OR jumper knee) (eccentric loading OR exercise) physical therapy'],
  [['十字韌帶', 'ACL', '前十字', '後十字', '韌帶斷裂', '韌帶開刀'], '(anterior cruciate ligament ACL reconstruction) (clinical practice guideline OR systematic review) rehabilitation'],
  [['半月板', '半月軟骨', '半月板撕裂'], '(meniscus tear) (conservative management OR physical therapy OR rehabilitation) guideline'],
  [['足底', '足底筋膜', '足底筋膜炎', '足跟痛', '腳底痛', '起床第一步', '腳跟刺痛'], '(plantar fasciitis) (clinical practice guideline OR systematic review) physical therapy stretching'],
  [['翻船', '腳踝', '踝關節', '腳踝扭傷', '扭到腳', '腳踝痛'], '(ankle sprain) (clinical practice guideline OR systematic review) physical therapy rehabilitation'],
  [['扁平足', '足弓', '內側足弓塌陷', '高足弓'], '(pes planus OR flatfoot) foot exercise physical therapy'],
  [['阿基里斯', '跟腱', '跟腱炎', '阿基里斯腱'], '(Achilles tendinopathy) (eccentric exercise OR physical therapy) systematic review'],
  [['五十肩', '沾黏', '肩膀卡', '凍結肩', '手舉不高', '肩關節囊', '沾黏性肩關節囊炎'], '(adhesive capsulitis OR frozen shoulder) (clinical practice guideline OR systematic review) physical therapy'],
  [['肩夾擠', '旋轉肌', '旋轉肌群', '旋轉肌袖', '肩膀痛', '夾擠'], '(subacromial shoulder impingement OR rotator cuff tendinopathy) (clinical practice guideline OR systematic review) physical therapy'],
  [['媽媽手', '手腕痛', '橈骨莖突', '大拇指痛'], '(De Quervain tenosynovitis) (conservative management OR physical therapy) guideline'],
  [['網球肘', '高爾夫球肘', '手肘痛', '手肘外側'], '(lateral epicondylitis OR tennis elbow) (physical therapy OR eccentric exercise) systematic review'],
  [['手麻', '腕隧道', '正中神經', '腕隧道症候群'], '(carpal tunnel syndrome) (clinical practice guideline OR systematic review) physical therapy'],
  [['三角纖維軟骨', 'TFCC', '手腕小指側'], '(triangular fibrocartilage complex TFCC wrist) physical therapy conservative rehabilitation'],
  [['離心收縮', '離心訓練', '離心運動'], '(eccentric exercise tendinopathy rehabilitation) systematic review'],
  [['等長收縮', '等長訓練'], '(isometric exercise pain relief tendon) systematic review'],
  [['筋膜放鬆', '滾筒', '筋膜槍', '按摩球'], '(myofascial release OR foam rolling) range of motion systematic review'],
];

// ── 執行期動態快取（Edge instance 級，TTL: 1 小時）────────────────
const dynamicCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function getDynamicCache(key) {
  const entry = dynamicCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL_MS) {
    dynamicCache.delete(key);
    return null;
  }
  return entry.value;
}

function setDynamicCache(key, value) {
  if (dynamicCache.size >= 100) {
    const oldestKey = dynamicCache.keys().next().value;
    dynamicCache.delete(oldestKey);
  }
  dynamicCache.set(key, { time: Date.now(), value });
}

// ── 即時 NCBI/PubMed 檢索函式 ─────────────
async function searchPubmedDirect(query) {
  try {
    // 1. 若為法規、收費、健保自費、流程等大眾制度與行政問題，直接跳過檢索，杜絕無關文獻
    if (PURE_ADMIN_KEYWORDS.some(k => query.includes(k))) {
      return null;
    }

    // 2. 精準匹配臨床 MeSH 主題詞
    let englishTerms = '';
    for (const [keywords, engQuery] of CLINICAL_ME_SH_MAP) {
      if (keywords.some(k => query.includes(k))) {
        englishTerms = engQuery;
        break;
      }
    }

    // 3. 若未命中任何特定臨床主題詞，絕不進行萬用兜底檢索（避免帶入無關文獻）
    if (!englishTerms) {
      return null;
    }

    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(englishTerms)}&retmode=json&retmax=2&sort=relevance`;
    const esearchRes = await fetch(esearchUrl);
    if (!esearchRes.ok) return null;
    const esearchData = await esearchRes.json();
    const idList = esearchData.esearchresult?.idlist || [];
    if (idList.length === 0) return null;

    const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
    const esummaryRes = await fetch(esummaryUrl);
    if (!esummaryRes.ok) return null;
    const esummaryData = await esummaryRes.json();
    const result = esummaryData.result || {};
    const articles = idList.map(pmid => {
      const doc = result[pmid];
      if (!doc) return null;
      return {
        pmid,
        title: doc.title || 'Untitled',
        source: doc.source || '',
        pubdate: doc.pubdate || '',
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    }).filter(Boolean);
    if (articles.length === 0) return null;
    return {
      type: 'NCBI PubMed 即時檢索結果（真實已驗證論文）',
      matchedSearchTerms: englishTerms,
      articles,
    };
  } catch (err) {
    console.error('[PubMed Direct Error]', err?.message);
    return null;
  }
}

// ── Web Standard Edge Handler ──────────────────────────────────────
export default async function handler(req) {
  // ── 統一基礎安全標頭 ──────────────────────────────────────────
  const secHeaders = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  // ── CORS：僅允許自家網域（鎖定同源，防 CSRF / 未授權 API 盜用）─
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') {
    if (isAllowedOrigin(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin || ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          ...secHeaders,
        },
      });
    }
    return new Response(null, { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: secHeaders,
    });
  }

  // ── 速率限制 ──────────────────────────────────────────────────
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: '請求次數過多，請稍後再試。' }), {
      status: 429,
      headers: secHeaders,
    });
  }

  // ── 解析 JSON Body ────────────────────────────────────────────
  let bodyData;
  try {
    bodyData = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '無效的 JSON 請求' }), {
      status: 400,
      headers: secHeaders,
    });
  }

  const { message, history = [] } = bodyData;

  // ── 輸入驗證 ─────────────────────────────────────────────────
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: '請輸入問題' }), {
      status: 400,
      headers: secHeaders,
    });
  }
  // [Security] 訊息長度上限，防止巨型 payload DoS 攻擊
  if (message.length > MAX_MESSAGE_LENGTH) {
    return new Response(JSON.stringify({ error: '問題過長，請精簡後再試（上限 2000 字）。' }), {
      status: 400,
      headers: secHeaders,
    });
  }
  // [Security] 嚴格驗證 history 格式，過濾非法 role（防 system-role prompt injection）
  if (!Array.isArray(history)) {
    return new Response(JSON.stringify({ error: '無效的對話格式' }), {
      status: 400,
      headers: secHeaders,
    });
  }
  const sanitizedHistory = history
    .filter(m =>
      m && typeof m === 'object' &&
      (m.role === 'user' || m.role === 'model') &&
      typeof m.content === 'string'
    )
    .slice(-(MAX_HISTORY_TURNS * 2))
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // [Security] 不洩漏伺服器設定細節給前端
    return new Response(JSON.stringify({ error: '服務暫時無法使用，請稍後再試。' }), {
      status: 500,
      headers: secHeaders,
    });
  }

  // ── 串流回傳標頭 ──────────────────────────────────────────────
  const streamHeaders = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (isAllowedOrigin(origin) && origin) {
    streamHeaders['Access-Control-Allow-Origin'] = origin;
  }

  // ── 快取查詢（僅無歷史對話時啟用）────────────────────────────
  const cacheKey = message.trim();
  if (sanitizedHistory.length === 0) {
    const cached = getDynamicCache(cacheKey);
    if (cached) {
      return new Response(cached, { headers: streamHeaders });
    }
  }

  // ① 平行查詢工具（限時 3.5s 保證不超時）
  let toolContext = '';
  try {
    const toolPromise = searchPubmedDirect(message);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
    const result = await Promise.race([toolPromise, timeoutPromise]);
    if (result) {
      toolContext = "\n\n--- 即時查詢結果（請根據以下真實論文資料回答與引用，嚴禁編造不存在的 PMID）---\n" + JSON.stringify(result, null, 2);
    }
  } catch {}

  // ② Edge 全串流傳輸（零超時、邊緣毫秒響應）
  const MODELS = ['gemini-3.6-flash', 'gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
  const genAI = new GoogleGenerativeAI(apiKey);

  const chatHistory = sanitizedHistory.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const userContent = message + toolContext;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      });

      const chat = model.startChat({ history: chatHistory });
      const result = await chat.sendMessageStream(userContent);

      const encoder = new TextEncoder();
      let fullResponseText = '';

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) {
                const localized = localizeTaiwanese(text);
                fullResponseText += localized;
                controller.enqueue(encoder.encode(localized));
              }
            }
            if (sanitizedHistory.length === 0 && fullResponseText.length > 50) {
              setDynamicCache(cacheKey, fullResponseText);
            }
            controller.close();
          } catch (streamErr) {
            console.error(`[Stream Error - ${modelName}]`, streamErr?.message);
            controller.error(streamErr);
          }
        },
      });

      return new Response(readableStream, { headers: streamHeaders });
    } catch (modelErr) {
      console.warn(`[Model ${modelName} Failed, Trying Fallback]`, modelErr?.message);
    }
  }

  return new Response(JSON.stringify({ error: 'AI 服務連線忙碌中，請稍後再試。' }), {
    status: 503,
    headers: secHeaders,
  });
}

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
1. 【依據使用者意圖，極致白話親民回覆】：
   - 全篇必須以「一般民眾、長輩、上班族都能輕鬆看懂」的台灣白話口語表達，嚴格禁止堆砌生硬晦澀的醫學解剖名詞或八股學術腔。
   - 若必須解釋身體機制，請務必搭配生活化比喻（例如：解釋「代償」請比喻為「原本該出力的肌肉偷懶，其他肌肉跑來加班代班結果累壞了」；解釋「核心」請比喻為「身體自帶的天然護腰」；解釋「腹內壓」請比喻為「肚子像吹氣球一樣向四周均勻撐開」）。
   - 動作步驟請用直覺的生活感官引導（例如：「想像屁股往後找椅子坐」、「肩膀自然放鬆下沉，不要縮脖子聳肩」）。
   - 根據使用者的具體問法給予合適切題的回覆：
     * 若諮詢【症狀/動作不適/傷後復健】（例如：「久坐腰痛」、「深蹲膝蓋卡卡」）：請依序提供：① 何時需就醫的危險警訊 ➔ ② 為什麼會痠痛（白話原因分析） ➔ ③ 你可以這樣做（日常調整與安全運動） ➔ ④ 應避免的動作 ➔ ⑤ 相關特定實證文獻。
     * 若詢問【特定文獻推薦/研究探討】：請直接切入推薦該篇文獻名稱、期刊結論與直達連結。切勿硬塞無關的安全篩檢或運動處方。
     * 若詢問【名詞概念/動作原理】：請以生活化白話解釋定義、日常實例與正確操作要點。
2. 【100% 台灣在地化繁中，嚴格杜絕中國大陸用語與英文摩擦】：
   - 全篇必須使用台灣繁體中文（正體中文）與台灣物理治療專業/生活習慣用語。
   - 【強制詞彙對照表（嚴格執行，違者重罰）】：
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
4. 【大眾化高品質實證依據（100% 取自下方即時檢索結果）】：
   - 目的在於讓民眾安心得知「建議有正式醫學研究支持，非網路道聽塗說」。【嚴格禁止使用「PubMed」等艱澀學術英文專有名詞】，請轉換為大眾一看就懂的親民可信用語。
   - 引用的超連結【必須 100% 取自下方「即時查詢結果」中的真實論文網址】。
   - 【文獻標題必須與該論文實際內容 1:1 精準對應】：將該篇英文論文的實際研究主題白話翻譯為繁體中文，清楚標註證據類型。
   - 【若下方即時檢索結果為空或查無文獻】：嚴格禁止自行編造任何 8 位數 PMID 網址或偽造論文連結！若查無文獻，請直接不要輸出【參考實證研究】區塊。
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
每個人身體的骨骼結構、生活習慣與不適原因皆不相同。若需要針對個人動作進行深入評估、專屬運動處方調整或一對一諮詢，歡迎加入官方 LINE 預約：👉 [點擊直接加入好友並預約諮詢](https://lin.ee/y6VBRuh)

---
⚖️ 免責聲明：本內容由 AI 實證小助手生成，僅供日常衛教參考，可能存在錯誤，無法替代真人專業醫療診斷。依《物理治療師法》第12條，實際處置應依醫師診斷或醫囑執行。若有身體不適，請務必諮詢合格醫師或物理治療師進行面對面臨床評估。`;

// ── 物理治療專業 MeSH 與臨床英文關鍵字對照庫 ──────────────────────
const CLINICAL_ME_SH_MAP = [
  [['下背', '腰痛', '腰痠', '久坐', '腰椎', '閃到腰', '閃腰'], 'low back pain lumbar core stability physical therapy exercise'],
  [['椎間盤', '椎間盤突出', '坐骨神經', '腳麻', '梨狀肌'], 'lumbar disc herniation radiculopathy sciatica physical therapy exercise'],
  [['骨盆前傾', '下交叉', '骨盆歪斜', '長短腳'], 'anterior pelvic tilt lower crossed syndrome physical therapy exercise'],
  [['骨盆後傾', '平背', '駝背', '圓肩', '上交叉', '烏龜頸', '富貴包'], 'upper crossed syndrome thoracic kyphosis forward head posture exercise'],
  [['落枕', '頸椎', '脖子痛', '脖子轉不過去', '膏盲'], 'cervical neck pain physical therapy exercise mobilization'],
  [['骨刺', '退化性脊椎', '脊椎滑脫'], 'lumbar spondylolisthesis spinal stenosis physical therapy exercise'],
  [['內扣', '內夾', '深蹲', '膝蓋內', 'X型腿', '膝外翻'], 'knee valgus dynamic squat hip abductor gluteus medius biomechanics'],
  [['跑者膝', '跑步膝蓋', '膝蓋外側', '髂脛束', 'ITB', 'ITBS'], 'iliotibial band syndrome ITBS runner knee physical therapy exercise'],
  [['髕骨', '髕骨軟化', '髕骨股骨', '膝蓋痛', '膝蓋卡卡', '退化性關節炎'], 'patellofemoral pain syndrome PFPS knee osteoarthritis physical therapy exercise'],
  [['跳躍膝', '髕骨肌腱', '髕骨帶'], 'patellar tendinopathy jumper knee eccentric loading exercise'],
  [['十字韌帶', 'ACL', '前十字', '後十字', '韌帶斷裂', '韌帶開刀'], 'anterior cruciate ligament ACL reconstruction rehabilitation exercise guideline'],
  [['半月板', '半月軟骨', '半月板撕裂'], 'meniscus tear conservative physical therapy exercise rehabilitation'],
  [['足底', '足底筋膜', '足跟痛', '腳底痛', '起床第一步', '腳跟刺痛'], 'plantar fasciitis physical therapy stretching loading exercise'],
  [['翻船', '腳踝', '踝關節', '腳踝扭傷', '扭到腳'], 'ankle sprain inversion physical therapy rehabilitation exercise guideline'],
  [['扁平足', '足弓', '內側足弓塌陷', '高足弓'], 'pes planus flatfoot arch intrinsic foot muscle exercise physical therapy'],
  [['阿基里斯', '跟腱', '跟腱炎'], 'Achilles tendinopathy eccentric loading exercise physical therapy'],
  [['五十肩', '沾黏', '肩膀卡', '凍結肩', '手舉不高', '肩關節囊'], 'adhesive capsulitis frozen shoulder physical therapy exercise mobilization'],
  [['肩夾擠', '旋轉肌', '旋轉肌袖', '肩膀痛', '夾擠'], 'subacromial impingement rotator cuff tendinopathy physical therapy exercise'],
  [['媽媽手', '手腕痛', '橈骨莖突', '大拇指痛'], 'De Quervain tenosynovitis physical therapy exercise conservative'],
  [['網球肘', '高爾夫球肘', '手肘痛', '手肘外側'], 'lateral epicondylitis tennis elbow physical therapy eccentric exercise'],
  [['手麻', '腕隧道', '正中神經'], 'carpal tunnel syndrome nerve gliding physical therapy exercise'],
  [['三角纖維軟骨', 'TFCC', '手腕小指側'], 'triangular fibrocartilage complex TFCC wrist physical therapy rehabilitation'],
  [['離心收縮', '離心訓練', '離心'], 'eccentric exercise physical therapy tendinopathy rehabilitation'],
  [['等長收縮', '等長訓練'], 'isometric exercise pain relief physical therapy'],
  [['向心收縮', '阻力訓練', '肌力訓練'], 'resistance strength training progressive overload physical therapy'],
  [['本體感覺', '平衡訓練', '神經肌肉'], 'proprioception neuromuscular control balance training rehabilitation'],
  [['筋膜放鬆', '滾筒', '筋膜槍', '按摩球'], 'myofascial release foam rolling physical therapy range of motion'],
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
    let englishTerms = '';
    for (const [keywords, engQuery] of CLINICAL_ME_SH_MAP) {
      if (keywords.some(k => query.includes(k))) {
        englishTerms = engQuery;
        break;
      }
    }
    if (!englishTerms) {
      englishTerms = 'physical therapy rehabilitation clinical practice guideline exercise';
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
    if (origin === ALLOWED_ORIGIN) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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
  if (origin === ALLOWED_ORIGIN) {
    streamHeaders['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
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
      toolContext = '\n\n--- 即時查詢結果（請根據以下真實論文資料回答與引用，嚴禁編造不存在的 PMID）---\n' + JSON.stringify(result, null, 2);
    }
  } catch {}

  // ② Edge 全串流傳輸（零超時、邊緣毫秒響應）
  const MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.0-flash'];
  const genAI = new GoogleGenerativeAI(apiKey);

  const chatHistory = sanitizedHistory.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = '';
      let success = false;
      let lastErrCode = 'UNKNOWN';

      for (const modelName of MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: SYSTEM_PROMPT,
          });
          const chat = model.startChat({ history: chatHistory });
          const resultStream = await chat.sendMessageStream(message + toolContext);

          for await (const chunk of resultStream.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              const localizedChunk = localizeTaiwanese(chunkText);
              fullText += localizedChunk;
              controller.enqueue(encoder.encode(localizedChunk));
            }
          }

          if (fullText) {
            setDynamicCache(cacheKey, fullText);
          }
          success = true;
          break;
        } catch (err) {
          // [Security] 完整錯誤僅記錄至 server log，不洩漏至 client
          console.error('[chat stream error]', modelName, err?.message);
          const msg = err?.message ?? '';
          if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
            lastErrCode = 'AUTH';
            break;
          }
          lastErrCode = 'MODEL';
          continue;
        }
      }

      if (!success) {
        // [Security] 對用戶僅顯示友善訊息，不洩漏 SDK 錯誤細節
        const userMsg = lastErrCode === 'AUTH'
          ? '\n\n⚠️ 服務驗證失敗，請聯絡管理員。'
          : '\n\n⚠️ 檢索服務暫時繁忙，請稍後再試。';
        controller.enqueue(encoder.encode(userMsg));
      }

      controller.close();
    },
  });

  return new Response(stream, { headers: streamHeaders });
}

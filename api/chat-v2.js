/**
 * api/chat-v2.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 台灣物理治療實證助手 v2 — 四大 RAG 進階優化策略整合端點（測試版）
 *
 * ⚠️  此為獨立測試端點，不影響正式 /api/chat 的任何邏輯
 *
 * 新增策略（相對於 /api/chat v1）：
 *   策略 1：混合檢索（Hybrid Search = Dense TF-IDF + BM25 + RRF）
 *   策略 2：查詢擴寫（LLM 口語 → 醫學術語 JSON，500ms timeout + 靜態規則降級）
 *   策略 3：實證重排（Cross-Encoder + CPG/RCT/SR 等級加權乘數）
 *   策略 4：結構化切塊（PICO + FITT 語料庫，corpus.js 中已預切塊）
 *
 * 並行架構：
 *   - 策略 2 查詢擴寫 + PubMed 即時補充（平行執行，限時 1500ms）
 *   - 策略 1+3 混合檢索 + 重排（本地計算，< 50ms）
 *   - 組裝完整 toolContext → Gemini 生成
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PT_CORPUS } from '../lib/rag/corpus.js';
import { hybridSearch } from '../lib/rag/vector-search.js';
import { expandQuery, buildHybridQueryString } from '../lib/rag/query-expander.js';
import { rerank, formatForPrompt } from '../lib/rag/reranker.js';

export const config = {
  runtime: 'edge',
};

// ── 安全常數（與 v1 相同）─────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS  = 10;
const ALLOWED_ORIGIN     = 'https://taiwan-pt-web.vercel.app';

// ── RAG 參數 ──────────────────────────────────────────────────────────────────
const HYBRID_CANDIDATE_K = 15;   // 混合檢索初篩候選數
const RERANK_TOP_N       = 4;    // 重排後最終送給 LLM 的段落數
const PUBMED_TIMEOUT_MS  = 1500; // PubMed 即時補充超時
const EXPAND_TIMEOUT_MS  = 500;  // 查詢擴寫 LLM 超時

// ── 原有 v1 的安全函式（直接引用相同邏輯）────────────────────────────────────
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === ALLOWED_ORIGIN) return true;
  if (origin.endsWith('.vercel.app') && origin.includes('taiwan-pt')) return true;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  return false;
}

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

// ── 台灣在地化用語轉換（與 v1 完全相同）─────────────────────────────────────
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
    .replace(/旋轉肌袖/g, '旋轉肌群')
    .replace(/運動劑量/g, '建議組數與次數')
    .replace(/劑量建議/g, '建議組數與次數')
    .replace(/建議劑量/g, '建議組數與次數')
    .replace(/劑量/g, '建議組數與次數');
}

// ── v2 增強版系統 Prompt（強調 FITT 運動參數與實證段落引用）─────────────────
const SYSTEM_PROMPT_V2 = `# Role Definition
你是「台灣物理治療實證小助手 v2」，專為台灣一般大眾設計的實證動作與物理治療衛教諮詢系統（進階版）。

# 核心執行原則 (Core Rules)
1. 【依據一般大眾需求，極致白話親民回覆】：
   - 全篇必須以「一般民眾、長輩、上班族都能輕鬆看懂」的台灣白話口語表達，嚴格禁止堆砌生硬晦澀的醫學解剖名詞或八股學術腔。
   - 若必須解釋身體機制，請搭配生活化比喻。
   - 動作步驟請用直覺的生活感官引導。

2. 【100% 台灣在地化繁中，嚴格杜絕「處方」與中國大陸用語】：
   - 全篇必須使用台灣繁體中文（正體中文）。
   - 【最高禁用詞】：全篇嚴格禁止出現「處*方」！一律改用「建議運動」、「運動指引」。
   - 【禁用詞彙】：嚴格禁止「劑*量」！一律改用「建議組數與次數」。

3. 【嚴謹俐落排版，白話清晰標題】：
   標題一律使用乾淨的中文方括號（如【安全篩檢與就醫指引】、【為什麼會這樣？原因分析】、【你可以這樣做（建議運動與日常調整）】、【應避免的動作】、【參考實證研究】）。

4. 【v2 新增：FITT 運動參數完整輸出】：
   - 在「你可以這樣做」區塊，**每個建議動作必須明確標出**：
     * 頻率（F）：每週幾次？
     * 強度（I）：幾成力？是否有疼痛警戒值？
     * 時間/次數（T）：幾組幾次？維持幾秒？
     * 類型（T）：等長？等張？離心？
     * ⚠️ 禁忌動作與警訊：哪些動作這時候絕對不能做？
   - 這些參數必須來自下方的「精選實證段落」，嚴禁憑空捏造！

5. 【v2 新增：優先引用精選實證段落（嚴格執行）】：
   - 當下方有「精選實證段落」時，你的回覆中的運動建議必須以這些段落為依據。
   - 引用格式保持與 v1 相同的實證微膠囊格式。
   - 若精選段落的主題與使用者問題不符，直接告知「目前知識庫尚未收錄此主題的精選實證」。

6. 【相關探索問題推薦】：
   在每篇回答結尾（在諮詢轉化區塊之前），主動提出 2 到 3 個延伸探索問題，格式：
   【相關探索】
   * [問題 1]
   * [問題 2]

7. 【直接輸出正式回答，嚴禁輸出內部思考】：嚴格禁止在回覆開頭輸出任何思考過程。

8. 【法規界限與文末統一格式】：
   每篇回答結尾均必須附上：

---

【需要運動物理治療師為您詳細評估嗎？】
AI 提供的是普遍實證指引，但每個人身體受力模式與代償機制皆具個別性。本系統由台灣執業物理治療師團隊建立與維護，若想進一步確認個人問題或預約實體一對一評估，歡迎透過本站專屬窗口與物理治療師聯繫：[點此加入駐站物理治療師諮詢窗口 ↗](https://lin.ee/y6VBRuh)`;

// ── PubMed 即時補充（保留 v1 機制，限時 1500ms）────────────────────────────
async function searchPubmedDirect(expandedQuery) {
  try {
    const pubmedQuery = expandedQuery?.pubmed_query;
    if (!pubmedQuery) return null;

    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(pubmedQuery)}&retmode=json&retmax=2&sort=relevance`;
    const esearchRes = await fetch(esearchUrl, { signal: AbortSignal.timeout(1200) });
    if (!esearchRes.ok) return null;
    const esearchData = await esearchRes.json();
    const idList = esearchData.esearchresult?.idlist || [];
    if (idList.length === 0) return null;

    const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
    const esummaryRes = await fetch(esummaryUrl, { signal: AbortSignal.timeout(1200) });
    if (!esummaryRes.ok) return null;
    const esummaryData = await esummaryRes.json();
    const result = esummaryData.result || {};

    const articles = idList.map(pmid => {
      const doc = result[pmid];
      if (!doc) return null;
      return { pmid, title: doc.title || 'Untitled', source: doc.source || '', pubdate: doc.pubdate || '', url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
    }).filter(Boolean);

    return articles.length > 0 ? { type: 'PubMed 即時補充（v2 精準查詢）', query: pubmedQuery, articles } : null;
  } catch {
    return null;
  }
}

// ── RAG Pipeline 核心流程 ─────────────────────────────────────────────────────
async function runRagPipeline(message, apiKey) {
  const timings = {};

  // ── 策略 2：查詢擴寫（+ PubMed 即時補充 並行執行）───────────────────────
  const t0 = Date.now();

  const [expandedQuery, pubmedResult] = await Promise.allSettled([
    expandQuery(message, apiKey, EXPAND_TIMEOUT_MS),
    (async () => {
      // 先等查詢擴寫有結果才打 PubMed（共享 timeout budget）
      const expanded = await Promise.race([
        expandQuery(message, apiKey, EXPAND_TIMEOUT_MS),
        new Promise(r => setTimeout(() => r(null), EXPAND_TIMEOUT_MS)),
      ]);
      return searchPubmedDirect(expanded);
    })(),
  ]);

  const expanded = expandedQuery.status === 'fulfilled' ? expandedQuery.value : null;
  const pubmed   = pubmedResult.status === 'fulfilled' ? pubmedResult.value : null;
  timings.expand = Date.now() - t0;

  // 行政/法規問題 → 跳過知識庫檢索，直接回傳
  if (expanded?.is_admin_query) {
    return {
      toolContext: '',
      timings,
      ragUsed: false,
      note: '行政/法規問題，跳過文獻檢索',
    };
  }

  // ── 策略 1：混合檢索（Dense + BM25 + RRF）────────────────────────────────
  const t1 = Date.now();
  const hybridQuery = buildHybridQueryString(expanded || {}, message) || message;
  const candidates = hybridSearch(hybridQuery, PT_CORPUS, HYBRID_CANDIDATE_K);
  timings.hybridSearch = Date.now() - t1;

  // ── 策略 3：重排（Cross-Encoder + 實證等級加權）─────────────────────────
  const t2 = Date.now();
  const reranked = rerank(hybridQuery, candidates, RERANK_TOP_N);
  timings.rerank = Date.now() - t2;

  // ── 組裝 toolContext ───────────────────────────────────────────────────────
  let toolContext = '';

  // 區塊 A：精選實證段落（策略 4 PICO+FITT 結構）
  if (reranked.length > 0) {
    toolContext += '\n\n' + formatForPrompt(reranked);
  }

  // 區塊 B：PubMed 即時補充
  if (pubmed) {
    toolContext += `\n\n--- PubMed 即時補充（請勿捏造，可引用以下真實論文）---\n${JSON.stringify(pubmed, null, 2)}`;
  }

  // 區塊 C：查詢擴寫診斷資訊（供 LLM 了解使用者問句語境）
  if (expanded && !expanded.is_admin_query) {
    toolContext += `\n\n--- 查詢擴寫結果（診斷語境，供參考）---\n臨床診斷：${expanded.clinical_condition || '—'}\n解剖目標：${(expanded.anatomical_targets || []).join('、')}\n生物力學因素：${(expanded.biomechanics || []).join('、')}\n擴寫來源：${expanded._source || '—'}`;
  }

  return {
    toolContext,
    timings,
    ragUsed: true,
    candidateCount: candidates.length,
    rerankedCount: reranked.length,
    topChunkTopic: reranked[0]?.chunk?.topic || null,
    expandSource: expanded?._source || null,
  };
}

// ── Web Standard Edge Handler ──────────────────────────────────────────────────
export default async function handler(req) {
  const secHeaders = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: secHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: '請求次數過多，請稍後再試。' }), { status: 429, headers: secHeaders });
  }

  let bodyData;
  try {
    bodyData = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '無效的 JSON 請求' }), { status: 400, headers: secHeaders });
  }

  const { message, history = [] } = bodyData;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: '請輸入問題' }), { status: 400, headers: secHeaders });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return new Response(JSON.stringify({ error: '問題過長，請精簡後再試（上限 2000 字）。' }), { status: 400, headers: secHeaders });
  }
  if (!Array.isArray(history)) {
    return new Response(JSON.stringify({ error: '無效的對話格式' }), { status: 400, headers: secHeaders });
  }

  const sanitizedHistory = history
    .filter(m => m && typeof m === 'object' && (m.role === 'user' || m.role === 'model') && typeof m.content === 'string')
    .slice(-(MAX_HISTORY_TURNS * 2))
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: '服務暫時無法使用，請稍後再試。' }), { status: 500, headers: secHeaders });
  }

  // ── 串流回傳標頭 ────────────────────────────────────────────────────────────
  const streamHeaders = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-RAG-Version': 'v2',
  };
  if (isAllowedOrigin(origin) && origin) {
    streamHeaders['Access-Control-Allow-Origin'] = origin;
  }

  // ── 執行 RAG Pipeline ────────────────────────────────────────────────────────
  let ragResult = { toolContext: '', ragUsed: false };
  try {
    const ragPromise = runRagPipeline(message, apiKey);
    const timeoutPromise = new Promise(r => setTimeout(() => r({ toolContext: '', ragUsed: false }), PUBMED_TIMEOUT_MS + EXPAND_TIMEOUT_MS + 200));
    ragResult = await Promise.race([ragPromise, timeoutPromise]);
  } catch (err) {
    console.error('[RAG Pipeline Error]', err?.message);
  }

  // ── Gemini 生成（串流）──────────────────────────────────────────────────────
  const MODELS = ['gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-flash-latest'];
  const genAI = new GoogleGenerativeAI(apiKey);

  const chatHistory = sanitizedHistory.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
  const userContent = message + (ragResult.toolContext ? ragResult.toolContext : '');

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT_V2,
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
        generationConfig: { temperature: 0.15, maxOutputTokens: 4096 },
      });

      const chat = model.startChat({ history: chatHistory });
      const result = await chat.sendMessageStream(userContent);

      const encoder = new TextEncoder();
      let fullResponseText = '';

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              let text = '';
              try { text = chunk.text(); } catch {
                const parts = chunk?.candidates?.[0]?.content?.parts;
                if (Array.isArray(parts)) text = parts.map(p => p.text || '').join('');
              }
              if (text) {
                const localized = localizeTaiwanese(text);
                fullResponseText += localized;
                controller.enqueue(encoder.encode(localized));
              }
            }

            if (fullResponseText && !fullResponseText.includes('需要運動物理治療師為您詳細評估嗎')) {
              const closing = `\n\n---\n\n【需要運動物理治療師為您詳細評估嗎？】\nAI 提供的是普遍實證指引，但每個人身體受力模式與代償機制皆具個別性。本系統由台灣執業物理治療師團隊建立與維護，若想進一步確認個人問題或預約實體一對一評估，歡迎透過本站專屬窗口與物理治療師聯繫：[點此加入駐站物理治療師諮詢窗口 ↗](https://lin.ee/y6VBRuh)`;
              fullResponseText += closing;
              controller.enqueue(encoder.encode(closing));
            }
            controller.close();
          } catch (streamErr) {
            console.error(`[Stream Error - ${modelName}]`, streamErr?.message);
            controller.close();
          }
        },
      });

      return new Response(readableStream, { headers: streamHeaders });
    } catch (modelErr) {
      console.warn(`[v2 Model ${modelName} Failed]`, modelErr?.message);
    }
  }

  // 故障自癒 fallback
  return new Response('很抱歉，服務暫時無法連線，請稍後再試。\n\n【需要運動物理治療師為您詳細評估嗎？】\nAI 提供的是普遍實證指引，若需進一步評估，歡迎透過本站專屬窗口聯繫：[點此加入駐站物理治療師諮詢窗口 ↗](https://lin.ee/y6VBRuh)', { headers: streamHeaders });
}

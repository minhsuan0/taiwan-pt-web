/**
 * lib/rag/embed.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 向量嵌入模組（策略 1：密集向量搜尋的基礎）
 *
 * 雙模式設計：
 *   Mode A: TF-IDF 向量（純 JS、完全離線、零 API 消耗）→ 本地測試時使用
 *   Mode B: Gemini Embedding API（`text-embedding-004`，768維）→ 生產環境可選
 *
 * 在本次測試架構中，預設使用 Mode A (TF-IDF)，確保不需要額外 API 配額。
 */

// ── TF-IDF 向量化（模組層級快取，避免重複計算）──────────────────────────────
let _corpusIdf = null;
let _corpusVectors = null;
let _corpusRef = null;

/**
 * 中文 + 英文混合斷詞
 * 將句子拆解為詞彙 token（中文逐字 + 英文整詞 + 數字）
 */
export function tokenize(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tokens = [];

  // 提取英文詞與數字
  const enWords = lower.match(/[a-z0-9]+(?:[-][a-z0-9]+)*/g) || [];
  tokens.push(...enWords);

  // 提取中文字符（每個中文字作為獨立 token）
  const zhChars = lower.match(/[\u4e00-\u9fff]/g) || [];
  tokens.push(...zhChars);

  // 中文 2-gram（提升語意捕捉）
  for (let i = 0; i < zhChars.length - 1; i++) {
    tokens.push(zhChars[i] + zhChars[i + 1]);
  }

  return tokens.filter(t => t.length > 0);
}

/**
 * 計算整個語料庫的 IDF（Inverse Document Frequency）
 * idf(t) = log((N + 1) / (df(t) + 1)) + 1   (smoothed)
 */
function buildIdf(corpus) {
  const N = corpus.length;
  const df = {};

  for (const chunk of corpus) {
    const toks = new Set(tokenize(chunk.full_text + ' ' + chunk.zh_keywords.join(' ') + ' ' + chunk.en_keywords.join(' ')));
    for (const tok of toks) {
      df[tok] = (df[tok] || 0) + 1;
    }
  }

  const idf = {};
  for (const [tok, freq] of Object.entries(df)) {
    idf[tok] = Math.log((N + 1) / (freq + 1)) + 1;
  }
  return idf;
}

/**
 * 計算一段文字的 TF-IDF 向量（稀疏，以 object 表示）
 */
function tfidfVector(text, idf) {
  const tokens = tokenize(text);
  const tf = {};
  for (const tok of tokens) {
    tf[tok] = (tf[tok] || 0) + 1;
  }
  const vec = {};
  for (const [tok, count] of Object.entries(tf)) {
    const tfidfScore = (count / tokens.length) * (idf[tok] || 1);
    if (tfidfScore > 0) vec[tok] = tfidfScore;
  }
  return vec;
}

/**
 * 餘弦相似度（稀疏向量）
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [tok, val] of Object.entries(vecA)) {
    dot += val * (vecB[tok] || 0);
    normA += val * val;
  }
  for (const val of Object.values(vecB)) {
    normB += val * val;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── 對外公開 API ──────────────────────────────────────────────────────────────

/**
 * 初始化語料庫向量（第一次調用時懶載入）
 */
export function initCorpusVectors(corpus) {
  if (_corpusRef === corpus) return; // 已初始化
  _corpusRef = corpus;
  _corpusIdf = buildIdf(corpus);
  _corpusVectors = corpus.map(chunk => {
    const text = [
      chunk.full_text,
      chunk.zh_keywords.join(' '),
      chunk.en_keywords.join(' '),
      chunk.population,
      chunk.intervention?.name || '',
      chunk.intervention?.contraindications || '',
    ].join(' ');
    return tfidfVector(text, _corpusIdf);
  });
}

/**
 * 計算查詢向量（TF-IDF 模式）
 * @param {string} queryText - 查詢文字（可以是中英文混合）
 * @param {Array} corpus - 語料庫（用於取得已建立的 IDF）
 * @returns {Object} 稀疏 TF-IDF 向量
 */
export function embedQuery(queryText, corpus) {
  if (!_corpusIdf || _corpusRef !== corpus) {
    initCorpusVectors(corpus);
  }
  return tfidfVector(queryText, _corpusIdf);
}

/**
 * 取得所有語料庫段落的預計算向量
 */
export function getCorpusVectors(corpus) {
  if (!_corpusVectors || _corpusRef !== corpus) {
    initCorpusVectors(corpus);
  }
  return _corpusVectors;
}

/**
 * 計算查詢向量與語料庫的相似度分數
 * @param {string} queryText
 * @param {Array} corpus
 * @returns {Array<{chunk, score}>} 按相似度降序排列
 */
export function denseScore(queryText, corpus) {
  const queryVec = embedQuery(queryText, corpus);
  const corpusVecs = getCorpusVectors(corpus);

  return corpus.map((chunk, idx) => ({
    chunk,
    score: cosineSimilarity(queryVec, corpusVecs[idx]),
  })).sort((a, b) => b.score - a.score);
}

// ── Gemini Embedding API（可選，生產環境升級使用）────────────────────────────
/**
 * 使用 Gemini Embedding API 計算文字向量（768 維）
 * 若 GEMINI_API_KEY 可用且 useGeminiEmbed=true 時呼叫
 */
export async function embedWithGemini(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
    }),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Gemini Embed API ${res.status}`);
  const data = await res.json();
  return data.embedding?.values || [];
}

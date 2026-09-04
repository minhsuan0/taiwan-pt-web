/**
 * lib/rag/vector-search.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 混合檢索模組（策略 1：Hybrid Search）
 *
 * 包含三個子模組：
 *   1. denseSearch()  — TF-IDF 語意相似度搜尋（Dense Vector Search）
 *   2. bm25Search()   — BM25 關鍵字精確搜尋（專為解剖名詞/測試名稱/法規條文優化）
 *   3. hybridRRF()    — Reciprocal Rank Fusion（RRF）融合兩路排序
 *
 * RRF 公式：
 *   Score(d) = Σ 1 / (k + rank_i(d))
 *   k = 60（標準值，防止高排名被過度強調）
 */

import { denseScore, tokenize } from './embed.js';

const RRF_K = 60;

// ── BM25 常數 ──────────────────────────────────────────────────────────────
const BM25_K1 = 1.5;  // 詞頻飽和參數
const BM25_B  = 0.75; // 文件長度正規化參數

/**
 * 計算語料庫中每個 token 的 IDF（for BM25）
 * idf_BM25(t) = log((N - df + 0.5) / (df + 0.5) + 1)
 */
function buildBm25Idf(corpus) {
  const N = corpus.length;
  const df = {};

  for (const chunk of corpus) {
    const toks = new Set(buildChunkBm25Tokens(chunk));
    for (const tok of toks) {
      df[tok] = (df[tok] || 0) + 1;
    }
  }

  const idf = {};
  for (const [tok, freq] of Object.entries(df)) {
    idf[tok] = Math.log((N - freq + 0.5) / (freq + 0.5) + 1);
  }
  return idf;
}

/**
 * 從 chunk 提取 BM25 用 token（加強解剖名詞、術語、法規條文的權重）
 */
function buildChunkBm25Tokens(chunk) {
  const parts = [
    chunk.full_text,
    ...chunk.zh_keywords,
    ...chunk.en_keywords,
    chunk.population,
    chunk.intervention?.name || '',
    chunk.intervention?.type || '',
    chunk.outcome || '',
  ];
  return tokenize(parts.join(' '));
}

/**
 * BM25 評分（對單筆 chunk）
 */
function bm25Score(queryTokens, chunkTokens, idf, avgLen) {
  const len = chunkTokens.length;
  const tf = {};
  for (const tok of chunkTokens) {
    tf[tok] = (tf[tok] || 0) + 1;
  }

  let score = 0;
  for (const tok of queryTokens) {
    if (!(tok in tf)) continue;
    const idfVal = idf[tok] || 0;
    const tfVal = tf[tok];
    const numerator = tfVal * (BM25_K1 + 1);
    const denominator = tfVal + BM25_K1 * (1 - BM25_B + BM25_B * (len / avgLen));
    score += idfVal * (numerator / denominator);
  }
  return score;
}

// 模組層級快取
let _bm25Cache = null;
let _bm25CorpusRef = null;

function initBm25Cache(corpus) {
  if (_bm25CorpusRef === corpus) return;
  _bm25CorpusRef = corpus;

  const chunkTokens = corpus.map(chunk => buildChunkBm25Tokens(chunk));
  const totalLen = chunkTokens.reduce((sum, toks) => sum + toks.length, 0);
  const avgLen = totalLen / corpus.length;
  const idf = buildBm25Idf(corpus);

  _bm25Cache = { chunkTokens, avgLen, idf };
}

// ── 對外公開 API ──────────────────────────────────────────────────────────────

/**
 * Dense 語意搜尋（TF-IDF 餘弦相似度）
 * @param {string} queryText
 * @param {Array} corpus
 * @param {number} topK
 * @returns {Array<{chunk, score, rank}>}
 */
export function denseSearch(queryText, corpus, topK = 20) {
  const scored = denseScore(queryText, corpus);
  return scored.slice(0, topK).map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

/**
 * BM25 關鍵字搜尋
 * 對解剖名詞（棘上肌、VMO、Lachman test）、法規條文（第12條）、
 * 特殊術語（Alfredson、PICO、FITT）有精確命中優勢
 * @param {string} queryText
 * @param {Array} corpus
 * @param {number} topK
 * @returns {Array<{chunk, score, rank}>}
 */
export function bm25Search(queryText, corpus, topK = 20) {
  initBm25Cache(corpus);
  const { chunkTokens, avgLen, idf } = _bm25Cache;
  const queryTokens = tokenize(queryText);

  const scored = corpus.map((chunk, idx) => ({
    chunk,
    score: bm25Score(queryTokens, chunkTokens[idx], idf, avgLen),
  })).sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((item, rank) => ({
    ...item,
    rank: rank + 1,
  }));
}

/**
 * Reciprocal Rank Fusion（RRF）混合兩路排序
 * 融合 Dense（語意）+ BM25（關鍵字）的排序結果
 *
 * @param {Array} denseResults  — [{chunk, score, rank}]
 * @param {Array} bm25Results   — [{chunk, score, rank}]
 * @param {number} topK         — 最終回傳筆數
 * @returns {Array<{chunk, rrfScore, denseRank, bm25Rank}>}
 */
export function hybridRRF(denseResults, bm25Results, topK = 20) {
  const scores = new Map();

  // Dense 排序貢獻
  for (const { chunk, rank } of denseResults) {
    const key = chunk.id;
    if (!scores.has(key)) scores.set(key, { chunk, rrfScore: 0, denseRank: null, bm25Rank: null });
    const entry = scores.get(key);
    entry.rrfScore += 1 / (RRF_K + rank);
    entry.denseRank = rank;
  }

  // BM25 排序貢獻
  for (const { chunk, rank } of bm25Results) {
    const key = chunk.id;
    if (!scores.has(key)) scores.set(key, { chunk, rrfScore: 0, denseRank: null, bm25Rank: null });
    const entry = scores.get(key);
    entry.rrfScore += 1 / (RRF_K + rank);
    entry.bm25Rank = rank;
  }

  return [...scores.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK);
}

/**
 * 完整混合搜尋（Dense + BM25 + RRF）
 * 一鍵呼叫，回傳最終融合後的排序結果
 *
 * @param {string} queryText  — 完整查詢（含擴寫後詞彙）
 * @param {Array}  corpus     — PT 語料庫
 * @param {number} topK       — 最終候選筆數（建議 20）
 * @returns {Array<{chunk, rrfScore, denseRank, bm25Rank}>}
 */
export function hybridSearch(queryText, corpus, topK = 20) {
  const denseResults = denseSearch(queryText, corpus, topK);
  const bm25Results  = bm25Search(queryText, corpus, topK);
  return hybridRRF(denseResults, bm25Results, topK);
}

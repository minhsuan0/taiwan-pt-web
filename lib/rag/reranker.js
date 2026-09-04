/**
 * lib/rag/reranker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 重排機制（策略 3：Reranker + 實證金字塔加權）
 *
 * 採用純 JS Cross-Encoder 模擬 + 實證等級加權分數，無需外部 API。
 *
 * 重排算法：
 *   Final Score = Cross-Encoder Score × Evidence Level Multiplier
 *
 *   Cross-Encoder Score = Weighted Sum of:
 *     - 查詢與 chunk 的 Token 層級 Jaccard 相似度
 *     - 解剖部位精確命中加分
 *     - 臨床情境匹配加分（phase 吻合）
 *     - 完整 FITT 參數加分
 *
 *   Evidence Level Multiplier：
 *     - Level A（CPG / SR / Meta-Analysis）× 1.30
 *     - Level B（RCT / Controlled Trial）  × 1.10
 *     - Level C（Cohort / Case Control）   × 1.00
 *     - 無等級標示                         × 0.90
 */

import { tokenize } from './embed.js';

// ── 實證等級加權乘數 ───────────────────────────────────────────────────────────
const EVIDENCE_MULTIPLIERS = {
  'A': 1.30,  // CPG / Cochrane SR / Meta-Analysis
  'B': 1.10,  // RCT / High-quality Controlled Trial
  'C': 1.00,  // Cohort / Case-Control / Expert Opinion
};

// ── 臨床分期關鍵字偵測（提升情境匹配分數）──────────────────────────────────
const PHASE_KEYWORDS = {
  early:      [/急性|0-4週|術後.*週|初期|剛受傷|剛手術|腫脹.*還/i],
  subacute:   [/亞急性|4-12週|中期|緩解期|消腫後|幾週後/i],
  functional: [/功能|重返|回運動|後期|長期|幾個月後|漸進/i],
  chronic:    [/慢性|3個月|長期|反覆|一直|已經很久/i],
};

// ── 解剖部位關鍵字（用於命中加分）─────────────────────────────────────────
const ANATOMY_BOOST_MAP = {
  'acl_rehab':             [/前十字|ACL|膝蓋韌帶|十字韌帶/i],
  'low_back_pain':         [/腰|下背|深蹲.*腰|腰椎|核心|閃腰/i],
  'achilles_tendinopathy': [/阿基里斯|跟腱|小腿.*腱|腓腸/i],
  'plantar_fasciitis':     [/足底|腳底|腳跟|足弓|晨起.*腳/i],
  'rotator_cuff_impingement': [/旋轉肌|肩夾擠|棘上肌|五十肩|肩膀痛/i],
  'pfps':                  [/髕骨|PFPS|膝蓋前|深蹲膝蓋|跑者膝.*前/i],
  'itbs':                  [/髂脛束|ITB|膝外側|跑者膝.*外/i],
  'neck_pain':             [/頸椎|落枕|脖子|頸部/i],
  'ankle_sprain':          [/踝|腳踝|翻船|扭傷|外踝/i],
  'knee_osteoarthritis':   [/退化性.*膝|膝關節退化|骨關節炎|上下樓梯.*膝/i],
  'wrist_hand':            [/媽媽手|手腕|大拇指|狄奎凡|腕部/i],
  'posture_scapular':      [/圓肩|駝背|上交叉|前鋸肌|肩胛骨/i],
  'lateral_epicondylitis': [/網球肘|外上髁|手肘外側/i],
  'gluteus_medius':        [/臀中肌|Trendelenburg|骨盆穩定|臀部無力/i],
  'sciatica_piriformis':   [/坐骨神經|梨狀肌|腿麻|臀深/i],
};

// ── 工具函式 ──────────────────────────────────────────────────────────────────

/**
 * Token 層級 Jaccard 相似度
 * J(A,B) = |A ∩ B| / |A ∪ B|
 */
function jaccardSimilarity(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * 偵測查詢中的臨床分期意圖
 */
function detectPhase(queryText) {
  for (const [phase, patterns] of Object.entries(PHASE_KEYWORDS)) {
    if (patterns.some(p => p.test(queryText))) return phase;
  }
  return null;
}

/**
 * 判斷 chunk 的 FITT 參數完整性分數
 * 完整的介入描述（含頻率、強度、時間、類型）給予加分
 */
function fittCompletenessScore(chunk) {
  const iv = chunk.intervention || {};
  let score = 0;
  if (iv.frequency) score += 0.05;
  if (iv.intensity) score += 0.05;
  if (iv.time) score += 0.05;
  if (iv.type) score += 0.05;
  if (iv.contraindications) score += 0.10; // 禁忌症完整性特別加分
  return score;
}

// ── Cross-Encoder 評分函式 ────────────────────────────────────────────────────

/**
 * 計算查詢與單筆 chunk 的 Cross-Encoder 相似度分數
 * @param {string[]} queryTokens
 * @param {Object} chunk
 * @param {string} queryText  — 原始查詢（用於情境匹配）
 * @param {string|null} detectedPhase
 * @returns {number}
 */
function crossEncoderScore(queryTokens, chunk, queryText, detectedPhase) {
  // 1. Token Jaccard 相似度（主要語意分）
  const chunkText = [
    chunk.full_text,
    chunk.population,
    chunk.intervention?.name || '',
    chunk.intervention?.contraindications || '',
    chunk.outcome || '',
    ...chunk.zh_keywords,
    ...chunk.en_keywords,
  ].join(' ');
  const chunkTokens = tokenize(chunkText);
  const semanticScore = jaccardSimilarity(queryTokens, chunkTokens);

  // 2. 解剖部位精確命中加分
  const topicPatterns = ANATOMY_BOOST_MAP[chunk.topic] || [];
  const anatomyBoost = topicPatterns.some(p => p.test(queryText)) ? 0.20 : 0;

  // 3. 臨床分期吻合加分
  const phaseBoost = (detectedPhase && chunk.phase === detectedPhase) ? 0.10 : 0;

  // 4. FITT 參數完整性加分
  const fittBoost = fittCompletenessScore(chunk);

  return semanticScore + anatomyBoost + phaseBoost + fittBoost;
}

// ── 對外公開 API ──────────────────────────────────────────────────────────────

/**
 * 重排候選段落
 *
 * @param {string}   queryText   — 使用者原始問句（含擴寫後詞彙）
 * @param {Array}    candidates  — hybridSearch 回傳的候選段落 [{chunk, rrfScore, ...}]
 * @param {number}   topN        — 最終輸出筆數（預設 5）
 * @returns {Array<{chunk, finalScore, ceScore, evidenceMultiplier, rrfScore}>}
 */
export function rerank(queryText, candidates, topN = 5) {
  if (!candidates || candidates.length === 0) return [];

  const queryTokens = tokenize(queryText);
  const detectedPhase = detectPhase(queryText);

  const scored = candidates.map(candidate => {
    const chunk = candidate.chunk;

    // Cross-Encoder 相似度分數
    const ceScore = crossEncoderScore(queryTokens, chunk, queryText, detectedPhase);

    // 實證等級乘數
    const evidenceMultiplier = EVIDENCE_MULTIPLIERS[chunk.evidence_level] || 0.90;

    // 最終分數
    const finalScore = ceScore * evidenceMultiplier;

    return {
      chunk,
      finalScore,
      ceScore,
      evidenceMultiplier,
      rrfScore: candidate.rrfScore || 0,
    };
  });

  return scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topN);
}

/**
 * 格式化重排結果為 Prompt 注入用的文字區塊
 * 確保每筆包含：族群、介入/FITT參數、禁忌、療效、實證等級、來源
 *
 * @param {Array} rerankedResults
 * @returns {string}
 */
export function formatForPrompt(rerankedResults) {
  if (!rerankedResults || rerankedResults.length === 0) return '';

  const lines = ['=== 精選實證段落（已依相關性與實證等級排序）==='];

  rerankedResults.forEach(({ chunk, finalScore, ceScore, evidenceMultiplier }, idx) => {
    const iv = chunk.intervention || {};
    lines.push(`
【段落 ${idx + 1}】主題：${chunk.topic}（分期：${chunk.phase}）
 適用族群：${chunk.population}
 介入動作：${iv.name || '—'}
 ▸ 頻率（F）：${iv.frequency || '—'}
 ▸ 強度（I）：${iv.intensity || '—'}
 ▸ 時間/次數（T）：${iv.time || '—'}
 ▸ 類型（T）：${iv.type || '—'}
 ▸ 禁忌與警訊：${iv.contraindications || '—'}
 臨床效益：${chunk.outcome || '—'}
 實證等級：Level ${chunk.evidence_level} × ${evidenceMultiplier}（相關性分數：${finalScore.toFixed(3)}）
 來源：${chunk.source}（PMID: ${chunk.pmid || 'N/A'}）
 連結：${chunk.url || '—'}`);
  });

  lines.push('\n（以上資料來自精選物理治療實證語料庫，請嚴格依據上述段落回答，嚴禁捏造不存在的研究數據）');
  return lines.join('\n');
}

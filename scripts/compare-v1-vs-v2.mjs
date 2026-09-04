/**
 * scripts/compare-v1-vs-v2.mjs
 * ──────────────────────────────────────────────────────────────────────────────
 * 直接呼叫 Gemini API 比對 v1（舊版）與 v2（RAG 增強版）的回答品質
 * 無需 vercel dev，直接從 Node.js 執行
 *
 * 執行：/Users/liminxuan/.local/node/bin/node scripts/compare-v1-vs-v2.mjs
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 讀取 .env 取得 API Key
function loadEnv() {
  try {
    const env = readFileSync(path.join(rootDir, '.env'), 'utf8');
    for (const line of env.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  } catch {}
}
loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ 找不到 GEMINI_API_KEY，請確認 .env 檔案');
  process.exit(1);
}

// ── 動態 import RAG 模組 ────────────────────────────────────────────────────
const { PT_CORPUS } = await import(`file://${rootDir}/lib/rag/corpus.js`);
const { hybridSearch } = await import(`file://${rootDir}/lib/rag/vector-search.js`);
const { expandQuery, buildHybridQueryString } = await import(`file://${rootDir}/lib/rag/query-expander.js`);
const { rerank, formatForPrompt } = await import(`file://${rootDir}/lib/rag/reranker.js`);

// ── 測試問題 ────────────────────────────────────────────────────────────────
const TEST_QUERIES = [
  {
    id: 'Q1',
    label: '深蹲腰痠（口語問句）',
    query: '我深蹲腰會痠怎麼辦？',
    expect_topics: ['low_back_pain'],
    expect_contains: ['核心', '臀', '頻率', '次', '禁忌'],
    hallucination_check: ['每週', '組', '次', '維持'],
  },
  {
    id: 'Q2',
    label: '阿基里斯腱斷裂復健（醫學術語）',
    query: '阿基里斯腱斷裂怎麼復健？有什麼動作可以做？',
    expect_topics: ['achilles_tendinopathy'],
    expect_contains: ['離心', '小腿', '次', '頻率'],
    hallucination_check: ['每天', '組', '秒', '维持'],
  },
  {
    id: 'Q3',
    label: '前十字韌帶術後禁忌（含禁忌詞）',
    query: '前十字韌帶手術後可以做哪些動作？哪些絕對不能做？',
    expect_topics: ['acl_rehab'],
    expect_contains: ['禁', '深蹲', '跳躍', '週'],
    hallucination_check: ['術後', '肌力', '週', '不能'],
  },
];

// ── V1 檢索邏輯（模擬舊版 CLINICAL_ME_SH_MAP 靜態規則）──────────────────────
const CLINICAL_ME_SH_MAP_V1 = [
  { keywords: ['下背', '腰痛', '腰痠', '久坐腰', '腰椎', '深蹲腰'], query: '(low back pain OR lumbar spine) AND (exercise therapy OR physical therapy) AND (systematic review OR guideline)' },
  { keywords: ['阿基里斯', '跟腱', '跟腱炎'], query: '(Achilles tendinopathy) AND (eccentric exercise OR physical therapy) systematic review' },
  { keywords: ['十字韌帶', 'ACL', '前十字'], query: '(anterior cruciate ligament ACL reconstruction) AND (rehabilitation guideline)' },
];

function v1GetQuery(userQuery) {
  for (const { keywords, query } of CLINICAL_ME_SH_MAP_V1) {
    if (keywords.some(k => userQuery.includes(k))) return query;
  }
  return null;
}

// ── V2 RAG Pipeline ──────────────────────────────────────────────────────────
async function runV2Pipeline(query) {
  const expanded = await expandQuery(query, GEMINI_API_KEY, 500);
  if (expanded.is_admin_query) return { context: '', meta: { skip: true } };

  const hybridQuery = buildHybridQueryString(expanded, query) || query;
  const candidates = hybridSearch(hybridQuery, PT_CORPUS, 15);
  const reranked = rerank(hybridQuery, candidates, 4);
  const contextBlock = formatForPrompt(reranked);

  return {
    context: contextBlock,
    meta: {
      expandSource: expanded._source,
      clinicalCondition: expanded.clinical_condition,
      topChunks: reranked.map(r => ({
        id: r.chunk.id,
        topic: r.chunk.topic,
        phase: r.chunk.phase,
        evidenceLevel: r.chunk.evidence_level,
        finalScore: r.finalScore.toFixed(3),
        fitt: {
          frequency: r.chunk.intervention?.frequency,
          intensity: r.chunk.intervention?.intensity,
          time: r.chunk.intervention?.time,
          type: r.chunk.intervention?.type,
        },
        contraindications: r.chunk.intervention?.contraindications?.slice(0, 80) + '...',
      })),
    },
  };
}

// ── 呼叫 Gemini 生成回答 ─────────────────────────────────────────────────────
async function callGemini(systemPrompt, userContent, label) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.15, maxOutputTokens: 1200 },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const err = await res.text();
      return `[API Error ${res.status}] ${err.slice(0, 100)}`;
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '[空回應]';
  } catch (e) {
    return `[Timeout/Error] ${e.message}`;
  }
}

const SYSTEM_V1 = `你是「台灣物理治療實證小助手」。回覆時請提供：
1. 何時須就醫的警訊
2. 為什麼會痠痛的原因
3. 建議運動（請說明動作名稱）
4. 應避免的動作
請用台灣繁體中文白話回答，不超過400字。`;

const SYSTEM_V2 = `你是「台灣物理治療實證小助手 v2」。
規則：
- 每個建議動作必須明確說出：頻率（每週幾次）、強度、次數/組數、禁忌動作
- 必須嚴格依據下方「精選實證段落」中的 FITT 參數回答
- 嚴禁憑空捏造組數、次數、強度
- 用台灣繁體中文白話，不超過500字`;

// ── 評分函式 ─────────────────────────────────────────────────────────────────
function scoreResponse(response, testCase, version) {
  const scores = {
    containsFitt: false,        // 是否含明確運動參數（次數/組數/頻率）
    containsContraindication: false, // 是否含禁忌動作
    containsExpectedContent: 0, // 期望關鍵詞命中數
    hasForbiddenWords: false,   // 是否有禁詞
    hasNumberedExercise: false, // 是否有具體數字
    totalScore: 0,
  };

  // FITT 參數偵測
  const hasFittPattern = /每[週天]|[0-9]+\s*[組次秒分]|[0-9]+\s*(週|天|次|組|秒)|維持\s*[0-9]|每\s*[0-9]/;
  scores.containsFitt = hasFittPattern.test(response);

  // 禁忌動作偵測
  scores.containsContraindication = /禁止|不能|避免|禁忌|不宜|勿|暫停/.test(response);

  // 具體數字偵測（表示有量化參數）
  scores.hasNumberedExercise = /[0-9]+/.test(response);

  // 期望關鍵詞命中
  const hits = testCase.hallucination_check.filter(kw => response.includes(kw));
  scores.containsExpectedContent = hits.length;

  // 禁詞檢查
  scores.hasForbiddenWords = response.includes('處方') || response.includes('運動劑量') || response.includes('劑量');

  // 計算總分（滿分 100）
  scores.totalScore =
    (scores.containsFitt ? 30 : 0) +
    (scores.containsContraindication ? 20 : 0) +
    (scores.hasNumberedExercise ? 15 : 0) +
    (hits.length / testCase.hallucination_check.length * 25) +
    (scores.hasForbiddenWords ? -20 : 10);

  return scores;
}

// ── 主程式 ───────────────────────────────────────────────────────────────────
const results = [];

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  V1 vs V2 RAG 回覆品質自動比對               ║');
console.log('╚══════════════════════════════════════════════════╝\n');

for (const testCase of TEST_QUERIES) {
  console.log(`\n🔍 [${testCase.id}] ${testCase.label}`);
  console.log(`   問句：「${testCase.query}」`);
  console.log('   ─────────────────────────────────────');

  // ── V1：直接靜態查詢，無 RAG context ────────────────────────────────────
  const v1PubmedQuery = v1GetQuery(testCase.query);
  const v1UserContent = testCase.query + (v1PubmedQuery
    ? `\n\n[v1 PubMed 查詢：${v1PubmedQuery}（模擬結果，略去 API）]`
    : '');
  console.log('   ⏳ 呼叫 Gemini (v1)...');
  const v1Response = await callGemini(SYSTEM_V1, v1UserContent, 'v1');

  // ── V2：完整 RAG Pipeline ─────────────────────────────────────────────────
  console.log('   ⏳ 執行 RAG Pipeline (v2)...');
  const v2 = await runV2Pipeline(testCase.query);
  const v2UserContent = testCase.query + (v2.context ? '\n\n' + v2.context : '');
  console.log('   ⏳ 呼叫 Gemini (v2)...');
  const v2Response = await callGemini(SYSTEM_V2, v2UserContent, 'v2');

  // ── 評分 ─────────────────────────────────────────────────────────────────
  const v1Score = scoreResponse(v1Response, testCase, 'v1');
  const v2Score = scoreResponse(v2Response, testCase, 'v2');

  results.push({ testCase, v1Response, v2Response, v2Meta: v2.meta, v1Score, v2Score });

  console.log(`   ✅ v1 得分：${v1Score.totalScore.toFixed(0)}/100`);
  console.log(`   ✅ v2 得分：${v2Score.totalScore.toFixed(0)}/100`);
}

// ── 輸出 JSON 結果供報告生成使用 ─────────────────────────────────────────────
import { writeFileSync } from 'fs';
const outputPath = path.join(rootDir, 'scripts', '_comparison_result.json');
writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n📄 詳細結果已儲存至：${outputPath}`);
console.log('✅ 比對完成！');

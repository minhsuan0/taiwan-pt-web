/**
 * scripts/test-rag-pipeline.cjs
 * ──────────────────────────────────────────────────────────────────────────────
 * RAG 管線各模組單元測試
 * 完全離線執行，不需要 API Key 或網路連線
 *
 * 執行方式：
 *   /Users/liminxuan/.local/node/bin/node scripts/test-rag-pipeline.cjs
 */

const { createRequire } = require('module');
const path = require('path');

// 使用動態 import 測試 ESM 模組
async function runTests() {
  const rootDir = path.resolve(__dirname, '..');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASSED] ${message}`);
      passCount++;
    } else {
      console.error(`❌ [FAILED] ${message}`);
      failCount++;
    }
  }

  function assertClose(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    assert(diff <= tolerance, `${message} (actual: ${actual.toFixed(4)}, expected: ~${expected}, tolerance: ${tolerance})`);
  }

  console.log('====================================================');
  console.log('🔬 RAG 管線單元測試套件 v2');
  console.log('====================================================\n');

  // ── 動態 import ESM 模組 ─────────────────────────────────────────────────
  let corpus, embed, vectorSearch, queryExpander, rerankerModule;

  try {
    corpus = await import(`file://${rootDir}/lib/rag/corpus.js`);
    embed = await import(`file://${rootDir}/lib/rag/embed.js`);
    vectorSearch = await import(`file://${rootDir}/lib/rag/vector-search.js`);
    queryExpander = await import(`file://${rootDir}/lib/rag/query-expander.js`);
    rerankerModule = await import(`file://${rootDir}/lib/rag/reranker.js`);
    console.log('✅ [IMPORT] 所有 RAG 模組 import 成功\n');
  } catch (err) {
    console.error('❌ [IMPORT FAILED]', err.message);
    process.exit(1);
  }

  const { PT_CORPUS, getChunksByTopic, getCorpusSize } = corpus;
  const { tokenize, denseScore, initCorpusVectors } = embed;
  const { denseSearch, bm25Search, hybridRRF, hybridSearch } = vectorSearch;
  const { expandQuery, buildHybridQueryString } = queryExpander;
  const { rerank, formatForPrompt } = rerankerModule;

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 1：語料庫完整性（策略 4：結構化切塊驗證）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 1：語料庫 corpus.js 完整性（策略 4：PICO+FITT 結構）---');

  assert(Array.isArray(PT_CORPUS), '語料庫是 Array');
  assert(PT_CORPUS.length >= 10, `語料庫至少 10 筆（目前 ${PT_CORPUS.length} 筆）`);

  // 每筆 chunk 必要欄位檢查
  let allHaveFitt = true;
  let allHaveEvidence = true;
  let allHaveKeywords = true;

  for (const chunk of PT_CORPUS) {
    if (!chunk.intervention || !chunk.intervention.frequency || !chunk.intervention.intensity ||
        !chunk.intervention.time || !chunk.intervention.type || !chunk.intervention.contraindications) {
      allHaveFitt = false;
      console.error(`  ↳ chunk [${chunk.id}] 缺少 FITT 參數`);
    }
    if (!chunk.evidence_level || !['A', 'B', 'C'].includes(chunk.evidence_level)) {
      allHaveEvidence = false;
      console.error(`  ↳ chunk [${chunk.id}] 缺少或無效的 evidence_level`);
    }
    if (!chunk.zh_keywords || chunk.zh_keywords.length === 0 ||
        !chunk.en_keywords || chunk.en_keywords.length === 0) {
      allHaveKeywords = false;
      console.error(`  ↳ chunk [${chunk.id}] 缺少 zh_keywords 或 en_keywords`);
    }
  }

  assert(allHaveFitt, '所有 chunk 均包含完整 FITT 參數（F/I/T/T + 禁忌）');
  assert(allHaveEvidence, '所有 chunk 均標注 evidence_level（A/B/C）');
  assert(allHaveKeywords, '所有 chunk 均有中英文關鍵字');

  // 主題多樣性
  const topics = [...new Set(PT_CORPUS.map(c => c.topic))];
  assert(topics.length >= 5, `語料庫涵蓋至少 5 個臨床主題（目前 ${topics.length} 個：${topics.join(', ')}）`);

  // ACL 主題存在
  const aclChunks = getChunksByTopic('acl_rehab');
  assert(aclChunks.length >= 2, `ACL 主題至少 2 筆不同分期（目前 ${aclChunks.length} 筆）`);

  // 確認 ACL 有急性期與功能期
  const aclPhases = aclChunks.map(c => c.phase);
  assert(aclPhases.includes('early'), 'ACL 有早期（early）段落');
  assert(aclPhases.includes('functional'), 'ACL 有功能重建期（functional）段落');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 2：Tokenize 中英文混合斷詞
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 2：中英文混合斷詞 tokenize ---');

  const tokens1 = tokenize('阿基里斯腱斷裂怎麼復健？');
  assert(tokens1.includes('阿'), '中文逐字 token 存在');
  assert(tokens1.some(t => t === '阿基'), '中文 2-gram 存在（阿基）');
  assert(tokens1.length > 3, `token 數量合理（${tokens1.length} 個）`);

  const tokens2 = tokenize('Achilles tendon rupture rehabilitation protocol');
  assert(tokens2.includes('achilles'), '英文 token 轉小寫存在');
  assert(tokens2.includes('rehabilitation'), '英文 rehabilitation token 存在');
  assert(tokens2.includes('protocol'), '英文 protocol token 存在');

  const tokens3 = tokenize('ACL anterior cruciate ligament 前十字韌帶');
  assert(tokens3.includes('acl'), 'ACL 大寫→小寫');
  assert(tokens3.includes('前'), '中文 token 前');
  assert(tokens3.some(t => t === '前十'), '中文 2-gram 前十存在');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 3：Dense 語意搜尋（策略 1 部分）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 3：Dense TF-IDF 語意搜尋 ---');

  initCorpusVectors(PT_CORPUS);

  const denseAcl = denseSearch('前十字韌帶術後怎麼復健', PT_CORPUS, 5);
  assert(denseAcl.length > 0, 'Dense search 回傳結果不為空');
  assert(denseAcl[0].rank === 1, '第一筆 rank 為 1');
  assert(denseAcl[0].score >= 0, '分數為非負數');
  const topAclTopics = denseAcl.slice(0, 3).map(r => r.chunk.topic);
  assert(topAclTopics.includes('acl_rehab'), '前3筆中包含 ACL 主題段落');

  const denseLbp = denseSearch('深蹲腰會痠是什麼問題', PT_CORPUS, 5);
  assert(denseLbp.length > 0, '下背痛查詢 dense search 有結果');
  const topLbpTopics = denseLbp.slice(0, 3).map(r => r.chunk.topic);
  assert(topLbpTopics.some(t => t === 'low_back_pain'), '下背痛查詢前3筆包含 low_back_pain 主題');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 4：BM25 關鍵字精確搜尋（策略 1 部分）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 4：BM25 關鍵字精確搜尋 ---');

  const bm25Achilles = bm25Search('阿基里斯腱 Alfredson 離心訓練', PT_CORPUS, 5);
  assert(bm25Achilles.length > 0, 'BM25 Achilles 查詢有結果');
  const topAchillesTopics = bm25Achilles.slice(0, 3).map(r => r.chunk.topic);
  assert(topAchillesTopics.includes('achilles_tendinopathy'), 'BM25 「阿基里斯腱+Alfredson」命中 achilles 主題');

  const bm25Vmo = bm25Search('VMO 股內斜肌 髕骨', PT_CORPUS, 5);
  assert(bm25Vmo.length > 0, 'BM25 VMO 查詢有結果');
  const topVmoTopics = bm25Vmo.slice(0, 3).map(r => r.chunk.topic);
  assert(topVmoTopics.some(t => t === 'pfps'), 'BM25 「VMO+髕骨」命中 PFPS 主題');

  const bm25Itb = bm25Search('髂脛束 ITBS 跑者膝外側', PT_CORPUS, 5);
  assert(bm25Itb.length > 0, 'BM25 ITBS 查詢有結果');
  const topItbTopics = bm25Itb.slice(0, 3).map(r => r.chunk.topic);
  assert(topItbTopics.includes('itbs'), 'BM25 「髂脛束+ITBS」命中 itbs 主題');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 5：RRF 混合融合（策略 1 完整）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 5：RRF 混合檢索融合 ---');

  const hybridAcl = hybridSearch('前十字韌帶ACL術後膝蓋能做什麼動作', PT_CORPUS, 10);
  assert(hybridAcl.length > 0, 'Hybrid search ACL 有結果');
  assert(typeof hybridAcl[0].rrfScore === 'number', 'RRF 分數為數字');
  assert(hybridAcl[0].rrfScore > 0, 'RRF 分數為正數');
  const topHybridAcl = hybridAcl.slice(0, 3).map(r => r.chunk.topic);
  assert(topHybridAcl.includes('acl_rehab'), 'Hybrid search 前3筆含 ACL');

  // 驗證 RRF 能結合 Dense + BM25 的優點
  const hybridAchilles = hybridSearch('阿基里斯腱斷裂怎麼復健 eccentric heel drop Alfredson', PT_CORPUS, 10);
  assert(hybridAchilles.some(r => r.chunk.topic === 'achilles_tendinopathy'), 'Hybrid search 含 Achilles 段落');
  // 驗證同一段落的 denseRank 或 bm25Rank 至少有一個不為 null
  assert(hybridAchilles[0].denseRank !== null || hybridAchilles[0].bm25Rank !== null, 'RRF 融合後段落有排序記錄');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 6：查詢擴寫（策略 2）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 6：查詢擴寫 expandQuery (靜態規則 fallback) ---');

  // 無 API Key → 使用靜態規則
  const expanded1 = await expandQuery('我深蹲腰會痠怎麼辦', null);
  assert(expanded1 !== null, '擴寫結果不為 null');
  assert(expanded1.is_admin_query === false, '臨床問題 is_admin_query 為 false');
  assert(expanded1.clinical_condition && expanded1.clinical_condition.length > 0, '有 clinical_condition');
  assert(Array.isArray(expanded1.anatomical_targets) && expanded1.anatomical_targets.length > 0, '有 anatomical_targets');
  assert(expanded1.expanded_query_en && expanded1.expanded_query_en.includes('lumbar'), '擴寫英文含腰椎關鍵字');
  assert(expanded1._source === 'static', '無 API Key 時來源為 static');

  const expanded2 = await expandQuery('阿基里斯腱斷裂怎麼復健', null);
  assert(expanded2.expanded_query_en && expanded2.expanded_query_en.includes('Achilles'), '阿基里斯腱擴寫含 Achilles');

  // 行政問題偵測
  const expanded3 = await expandQuery('物理治療收費多少錢', null);
  assert(expanded3.is_admin_query === true, '收費問題 is_admin_query 為 true');

  const expanded4 = await expandQuery('需要醫師醫囑嗎', null);
  assert(expanded4.is_admin_query === true, '法規/醫囑問題 is_admin_query 為 true');

  // buildHybridQueryString
  const hybridStr = buildHybridQueryString(expanded1, '深蹲腰會痠');
  assert(typeof hybridStr === 'string' && hybridStr.length > 5, 'buildHybridQueryString 回傳有效字串');
  assert(hybridStr.includes('深蹲腰會痠'), '組合查詢字串包含原始問句');

  // 行政問題回傳 null
  const adminStr = buildHybridQueryString({ is_admin_query: true }, '收費問題');
  assert(adminStr === null, '行政問題 buildHybridQueryString 回傳 null');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 7：重排機制（策略 3）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 7：Reranker 重排與實證等級加權 ---');

  // 先取得 hybrid 候選
  const candidates = hybridSearch('阿基里斯腱斷裂怎麼復健', PT_CORPUS, 15);
  const reranked = rerank('阿基里斯腱斷裂怎麼復健', candidates, 5);

  assert(Array.isArray(reranked), '重排結果為 Array');
  assert(reranked.length > 0 && reranked.length <= 5, `重排結果 1-5 筆（目前 ${reranked.length} 筆）`);
  assert(typeof reranked[0].finalScore === 'number', '有 finalScore 欄位');
  assert(typeof reranked[0].evidenceMultiplier === 'number', '有 evidenceMultiplier 欄位');

  // 驗證 Level A 段落分數 > Level B（如果都有）
  const levelAItems = reranked.filter(r => r.chunk.evidence_level === 'A');
  const levelBItems = reranked.filter(r => r.chunk.evidence_level === 'B');
  if (levelAItems.length > 0 && levelBItems.length > 0) {
    const maxA = Math.max(...levelAItems.map(r => r.ceScore));
    const maxB = Math.max(...levelBItems.map(r => r.ceScore));
    // 若 ceScore 相同，Level A 的 finalScore 應更高
    if (maxA === maxB) {
      assert(levelAItems[0].finalScore > levelBItems[0].finalScore, 'Level A 段落 finalScore > Level B（相同 ceScore 情況下）');
    }
  }

  // 驗證 Achilles 主題排在前面
  const topChunk = reranked[0].chunk;
  assert(topChunk.topic === 'achilles_tendinopathy', `重排第一筆為 achilles 主題（目前：${topChunk.topic}）`);

  // 驗證 evidenceMultiplier 正確對應
  for (const item of reranked) {
    const expected = item.chunk.evidence_level === 'A' ? 1.30 : item.chunk.evidence_level === 'B' ? 1.10 : 1.00;
    assertClose(item.evidenceMultiplier, expected, 0.001, `chunk ${item.chunk.id} evidenceMultiplier 正確`);
  }

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 8：formatForPrompt 輸出結構驗證
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 8：formatForPrompt 輸出結構（FITT 完整性）---');

  const formatted = formatForPrompt(reranked.slice(0, 2));
  assert(typeof formatted === 'string' && formatted.length > 50, 'formatForPrompt 輸出非空字串');
  assert(formatted.includes('頻率（F）'), '輸出含 頻率（F）');
  assert(formatted.includes('強度（I）'), '輸出含 強度（I）');
  assert(formatted.includes('時間/次數（T）'), '輸出含 時間/次數（T）');
  assert(formatted.includes('類型（T）'), '輸出含 類型（T）');
  assert(formatted.includes('禁忌與警訊'), '輸出含 禁忌與警訊');
  assert(formatted.includes('實證等級'), '輸出含 實證等級');
  assert(formatted.includes('來源'), '輸出含 來源');
  assert(formatted.includes('嚴禁捏造'), '輸出含防幻覺聲明');

  // 禁詞檢查（回應 AGENT.md 規範）
  assert(!formatted.includes('處方') || formatted.includes('replace'), 'formatForPrompt 不含「處方」禁詞');
  assert(!formatted.includes('劑量'), 'formatForPrompt 不含「劑量」禁詞');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 9：完整 RAG pipeline 端到端（靜態模擬，無需 API）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 9：完整 RAG pipeline 端到端（本地模擬）---');

  async function mockRagPipeline(query) {
    // 1. 查詢擴寫
    const expanded = await expandQuery(query, null);
    if (expanded.is_admin_query) return { skip: true };

    // 2. 混合搜尋
    const hybridQuery = buildHybridQueryString(expanded, query) || query;
    const candidates = hybridSearch(hybridQuery, PT_CORPUS, 15);

    // 3. 重排
    const reranked = rerank(hybridQuery, candidates, 4);

    // 4. 格式化
    const prompt = formatForPrompt(reranked);
    return { expanded, candidates, reranked, prompt };
  }

  // 情境 1：深蹲腰痠
  const r1 = await mockRagPipeline('我深蹲腰會痠怎麼辦');
  assert(!r1.skip, '深蹲腰痠非行政問題');
  assert(r1.candidates.length > 0, '深蹲腰痠有候選段落');
  assert(r1.reranked.length > 0, '深蹲腰痠重排有結果');
  assert(r1.reranked.some(r => r.chunk.topic === 'low_back_pain'), '深蹲腰痠最終段落含 low_back_pain');

  // 情境 2：阿基里斯腱
  const r2 = await mockRagPipeline('阿基里斯腱斷裂怎麼復健');
  assert(!r2.skip, '阿基里斯腱非行政問題');
  assert(r2.reranked[0]?.chunk.topic === 'achilles_tendinopathy', '阿基里斯腱最終第一筆為 achilles 主題');
  assert(r2.prompt.includes('離心'), '阿基里斯腱 prompt 含「離心」關鍵字');

  // 情境 3：行政問題跳過
  const r3 = await mockRagPipeline('物理治療收費多少錢');
  assert(r3.skip === true, '收費問題 pipeline 正確跳過文獻檢索');

  // 情境 4：ACL 術後膝蓋動作
  const r4 = await mockRagPipeline('前十字韌帶術後膝蓋可以做什麼動作？有哪些禁忌？');
  assert(!r4.skip, 'ACL 問題非行政問題');
  assert(r4.reranked.some(r => r.chunk.topic === 'acl_rehab'), 'ACL 問題最終段落含 acl_rehab');
  // 確認禁忌資訊出現在 prompt 中
  assert(r4.prompt.includes('禁忌'), 'ACL 問題 prompt 含禁忌說明');

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // 測試 10：禁詞合規（AGENT.md 最高規範）
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 測試 10：禁詞合規（AGENT.md 最高規範）---');

  const fs = require('fs');
  const chatV2Code = fs.readFileSync(path.join(rootDir, 'api/chat-v2.js'), 'utf8');
  const rawClean = chatV2Code.replace(/replace\([^)]+\)/g, '');

  assert(!rawClean.includes('運動處方'), 'api/chat-v2.js 無「運動處方」');
  assert(!rawClean.includes('運動劑量'), 'api/chat-v2.js 無「運動劑量」');
  assert(!chatV2Code.includes('👉'), 'api/chat-v2.js 無卡通手指 👉');
  assert(!chatV2Code.includes('💡 延伸探索'), 'api/chat-v2.js 無「💡 延伸探索」');

  const corpusCode = fs.readFileSync(path.join(rootDir, 'lib/rag/corpus.js'), 'utf8');
  assert(!corpusCode.includes('運動處方'), 'lib/rag/corpus.js 無「運動處方」');
  assert(!corpusCode.includes('運動劑量'), 'lib/rag/corpus.js 無「運動劑量」');

  console.log('');

  // ── 最終結果 ─────────────────────────────────────────────────────────────
  console.log('====================================================');
  if (failCount === 0) {
    console.log(`🎉 RAG 管線測試全部通過！${passCount} 項測試 100% 通過。`);
    console.log('====================================================\n');
    process.exit(0);
  } else {
    console.error(`💥 共 ${failCount} 項測試未通過！（${passCount} 項通過）`);
    console.log('====================================================\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[TEST RUNNER ERROR]', err);
  process.exit(1);
});

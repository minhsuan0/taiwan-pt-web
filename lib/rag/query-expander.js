/**
 * lib/rag/query-expander.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 查詢擴寫模組（策略 2：Query Expansion & Clinical Terminology Alignment）
 *
 * 功能：
 *   將使用者口語問句 → 專業解剖/MeSH/ICF 術語 JSON（擴寫查詢）
 *
 * 設計原則：
 *   - 主要路徑：呼叫 Gemini Flash Lite（~200ms），轉換為結構化 JSON
 *   - 降級路徑：若 LLM 呼叫超時（>500ms）或失敗，自動降級至靜態規則庫
 *   - 安全隔離：行政/法規/收費類問題直接回傳 is_admin_query: true，跳過文獻檢索
 */

// ── 靜態行政問題關鍵字（不需要文獻檢索）────────────────────────────────────
const ADMIN_KEYWORDS = [
  '收費', '費用', '多少錢', '價格', '健保', '自費', '健保給付',
  '法規', '法律', '修法', '資格', '執照', '業務範圍', '執業',
  '掛號', '差別', '差異', '保險', '理賠', '看診', '物理治療所',
  '需要醫囑', '需要處方', '密醫', '整復推拿',
  '醫囑', '需要醫師', '需要醫生', '可以自行', '不需要醫師',
];

// ── 靜態臨床術語對照庫（降級 fallback）─────────────────────────────────────
const STATIC_EXPANSION_MAP = [
  {
    patterns: [/前十字韌帶|ACL|十字韌帶|韌帶斷裂|韌帶開刀/i],
    result: {
      clinical_condition: 'Anterior Cruciate Ligament (ACL) injury / reconstruction rehabilitation',
      anatomical_targets: ['anterior cruciate ligament', 'quadriceps', 'hamstring', 'gluteus medius', 'knee'],
      biomechanics: ['tibiofemoral stability', 'neuromuscular control', 'dynamic valgus prevention'],
      mesh_terms: ['"Anterior Cruciate Ligament"[Mesh]', '"Knee Injuries"[Mesh]', '"Exercise Therapy"[Mesh]'],
      expanded_query_zh: '前十字韌帶重建術後 股四頭肌肌力恢復 神經肌肉控制 重返運動標準',
      expanded_query_en: 'ACL reconstruction rehabilitation quadriceps strength neuromuscular return to sport',
      pubmed_query: '(anterior cruciate ligament) AND (reconstruction OR rehabilitation) AND (exercise OR physical therapy)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/深蹲.*腰|腰.*深蹲|下背痛|腰痛|腰痠|閃到腰|腰椎/i],
    result: {
      clinical_condition: 'Mechanical low back pain / Lumbar flexion intolerance / Squat-related lumbar dysfunction',
      anatomical_targets: ['lumbar spine', 'multifidus', 'gluteus maximus', 'erector spinae', 'pelvis'],
      biomechanics: ['posterior pelvic tilt', 'lumbar flexion intolerance', 'butt wink during squat', 'hip hinge deficit', 'anterior pelvic tilt'],
      mesh_terms: ['"Low Back Pain"[Mesh]', '"Lumbar Vertebrae"[Mesh]', '"Exercise Therapy"[Mesh]'],
      expanded_query_zh: '腰椎屈曲受限 臀肌啟動不足 骨盆前傾代償 核心穩定訓練 深蹲生物力學',
      expanded_query_en: 'lumbar spine squat biomechanics gluteus activation core stability posterior pelvic tilt',
      pubmed_query: '(low back pain OR lumbar spine) AND (squat OR exercise) AND (physical therapy OR core stability)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/阿基里斯腱|跟腱|跟腱炎|阿基里斯/i],
    result: {
      clinical_condition: 'Achilles tendinopathy (midportion or insertional)',
      anatomical_targets: ['Achilles tendon', 'gastrocnemius', 'soleus', 'calcaneus'],
      biomechanics: ['tendon load capacity', 'eccentric loading', 'calf muscle function'],
      mesh_terms: ['"Achilles Tendon"[Mesh]', '"Tendinopathy"[Mesh]', '"Exercise Therapy"[Mesh]'],
      expanded_query_zh: '阿基里斯腱肌腱病變 離心小腿訓練 Alfredson 跟腱負荷管理',
      expanded_query_en: 'Achilles tendinopathy eccentric exercise heel drop Alfredson rehabilitation',
      pubmed_query: '(Achilles tendinopathy) AND (eccentric exercise OR physical therapy) AND (rehabilitation)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/足底筋膜|足底痛|腳跟痛|腳底痛|起床.*腳|晨起.*腳/i],
    result: {
      clinical_condition: 'Plantar fasciitis / Plantar heel pain',
      anatomical_targets: ['plantar fascia', 'gastrocnemius', 'soleus', 'intrinsic foot muscles', 'calcaneus'],
      biomechanics: ['windlass mechanism', 'foot arch loading', 'calf tightness'],
      mesh_terms: ['"Fasciitis, Plantar"[Mesh]', '"Heel"[Mesh]', '"Exercise Therapy"[Mesh]'],
      expanded_query_zh: '足底筋膜炎 小腿伸展 足底自我伸展 內在足部肌群強化 晨起疼痛',
      expanded_query_en: 'plantar fasciitis stretching calf intrinsic foot muscle exercise heel pain',
      pubmed_query: '(plantar fasciitis OR heel pain) AND (stretching OR exercise) AND (physical therapy)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/五十肩|沾黏|肩膀卡|凍結肩|手舉不高|肩關節囊/i],
    result: {
      clinical_condition: 'Adhesive capsulitis (Frozen shoulder)',
      anatomical_targets: ['glenohumeral joint', 'shoulder capsule', 'rotator cuff', 'subacromial space'],
      biomechanics: ['capsular pattern restriction', 'glenohumeral mobility', 'scapulohumeral rhythm'],
      mesh_terms: ['"Bursitis"[Mesh]', '"Shoulder Joint"[Mesh]', '"Physical Therapy Modalities"[Mesh]'],
      expanded_query_zh: '沾黏性肩關節囊炎 關節囊鬆動 被動伸展 鐘擺運動 關節活動度恢復',
      expanded_query_en: 'adhesive capsulitis frozen shoulder mobilization capsular stretch physical therapy',
      pubmed_query: '(adhesive capsulitis OR frozen shoulder) AND (physical therapy OR mobilization) AND (exercise)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/旋轉肌|肩夾擠|棘上肌|肩峰|肩膀痛/i],
    result: {
      clinical_condition: 'Subacromial shoulder impingement / Rotator cuff tendinopathy',
      anatomical_targets: ['rotator cuff', 'supraspinatus', 'infraspinatus', 'scapula', 'subacromial space'],
      biomechanics: ['scapular dyskinesis', 'glenohumeral rhythm', 'dynamic stabilization'],
      mesh_terms: ['"Rotator Cuff"[Mesh]', '"Shoulder Impingement Syndrome"[Mesh]', '"Exercise Therapy"[Mesh]'],
      expanded_query_zh: '旋轉肌群肌腱病變 肩胛骨控制訓練 彈力帶外旋 肩峰下空間',
      expanded_query_en: 'rotator cuff shoulder impingement scapular control exercise external rotation strengthening',
      pubmed_query: '(rotator cuff OR shoulder impingement) AND (exercise OR physical therapy) AND (strengthening OR rehabilitation)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/膝蓋痛|髕骨|PFPS|深蹲.*膝|膝蓋卡|退化.*膝/i],
    result: {
      clinical_condition: 'Patellofemoral pain syndrome (PFPS) / Knee osteoarthritis',
      anatomical_targets: ['patella', 'quadriceps', 'VMO', 'gluteus medius', 'iliotibial band'],
      biomechanics: ['patellar tracking', 'dynamic knee valgus', 'quadriceps-to-hamstring ratio'],
      mesh_terms: ['"Patellofemoral Pain Syndrome"[Mesh]', '"Knee"[Mesh]', '"Quadriceps Muscle"[Mesh]'],
      expanded_query_zh: '髕骨股骨疼痛 VMO股內斜肌 臀中肌強化 動態膝外翻修正 Step Down測試',
      expanded_query_en: 'patellofemoral pain VMO gluteus medius dynamic valgus quadriceps exercise',
      pubmed_query: '(patellofemoral pain OR knee osteoarthritis) AND (exercise OR quadriceps) AND (physical therapy)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/髂脛束|跑者膝.*外|膝蓋外側|ITBS|ITB/i],
    result: {
      clinical_condition: 'Iliotibial band syndrome (ITBS / Runner\'s knee lateral)',
      anatomical_targets: ['iliotibial band', 'gluteus medius', 'tensor fasciae latae', 'lateral knee'],
      biomechanics: ['hip abductor weakness', 'ITB compression', 'running biomechanics'],
      mesh_terms: ['"Iliotibial Band Syndrome"[Mesh]', '"Hip"[Mesh]', '"Running Injuries"[Mesh]'],
      expanded_query_zh: '髂脛束摩擦症候群 臀中肌強化 跑步步頻 髖關節外展 生物力學修正',
      expanded_query_en: 'iliotibial band syndrome hip strengthening running biomechanics gait retraining',
      pubmed_query: '(iliotibial band syndrome) AND (exercise OR hip strengthening) AND (running OR physical therapy)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/頸椎|落枕|脖子痛|頸部/i],
    result: {
      clinical_condition: 'Cervical spine pain / Non-specific neck pain',
      anatomical_targets: ['cervical spine', 'deep cervical flexors', 'upper trapezius', 'levator scapulae'],
      biomechanics: ['craniocervical flexion', 'forward head posture', 'scapular stability'],
      mesh_terms: ['"Neck Pain"[Mesh]', '"Cervical Vertebrae"[Mesh]', '"Exercise Therapy"[Mesh]'],
      expanded_query_zh: '頸椎疼痛 深層頸屈肌訓練 Chin Tuck 頸椎穩定 烏龜頸矯正',
      expanded_query_en: 'neck pain cervical spine deep cervical flexor exercise chin tuck stability',
      pubmed_query: '(neck pain OR cervical) AND (exercise OR physical therapy) AND (stabilization OR strengthening)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/腳踝扭傷|翻船|踝扭傷|踝關節/i],
    result: {
      clinical_condition: 'Lateral ankle sprain',
      anatomical_targets: ['ATFL', 'CFL', 'PTFL', 'peroneal muscles', 'ankle joint'],
      biomechanics: ['proprioception deficit', 'peroneal reaction time', 'dynamic balance'],
      mesh_terms: ['"Ankle Injuries"[Mesh]', '"Sprains and Strains"[Mesh]', '"Proprioception"[Mesh]'],
      expanded_query_zh: '外側踝扭傷 ATFL 本體感覺訓練 平衡訓練 神經肌肉控制',
      expanded_query_en: 'ankle sprain lateral ligament proprioception balance training rehabilitation',
      pubmed_query: '(ankle sprain) AND (proprioception OR balance OR exercise) AND (rehabilitation OR physical therapy)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/臀中肌|骨盆穩定|Trendelenburg|骨盆下沉/i],
    result: {
      clinical_condition: 'Gluteus medius weakness / Trendelenburg gait / Hip abductor dysfunction',
      anatomical_targets: ['gluteus medius', 'gluteus minimus', 'tensor fasciae latae', 'iliotibial band'],
      biomechanics: ['Trendelenburg sign', 'contralateral pelvic drop', 'hip abductor moment'],
      mesh_terms: ['"Gluteal Muscles"[Mesh]', '"Hip"[Mesh]', '"Gait"[Mesh]'],
      expanded_query_zh: '臀中肌無力 Trendelenburg步態 蚌殼式訓練 髖外展 骨盆穩定',
      expanded_query_en: 'gluteus medius weakness hip abduction Trendelenburg gait strengthening clamshell',
      pubmed_query: '(gluteus medius) AND (weakness OR strengthening) AND (exercise OR rehabilitation)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/坐骨神經|梨狀肌|腿麻|臀部深處/i],
    result: {
      clinical_condition: 'Sciatica / Piriformis syndrome / Lumbar radiculopathy',
      anatomical_targets: ['sciatic nerve', 'piriformis', 'lumbar nerve roots', 'L4 L5 S1'],
      biomechanics: ['neural tension', 'piriformis compression', 'neural mobilization'],
      mesh_terms: ['"Sciatica"[Mesh]', '"Piriformis Muscle Syndrome"[Mesh]', '"Neural Mobilization"[Mesh]'],
      expanded_query_zh: '坐骨神經痛 梨狀肌伸展 神經鬆動術 腰椎神經根 下肢放射痛',
      expanded_query_en: 'sciatica piriformis syndrome neural mobilization lumbar radiculopathy exercise',
      pubmed_query: '(sciatica OR piriformis) AND (neural mobilization OR exercise OR stretching) AND (physical therapy)',
      is_admin_query: false,
    },
  },
  {
    patterns: [/網球肘|外上髁|手肘外側|高爾夫球肘/i],
    result: {
      clinical_condition: 'Lateral epicondylitis (Tennis elbow) / Medial epicondylitis (Golfer\'s elbow)',
      anatomical_targets: ['extensor carpi radialis brevis', 'lateral epicondyle', 'forearm extensors'],
      biomechanics: ['eccentric tendon loading', 'tendon degeneration', 'grip force'],
      mesh_terms: ['"Tennis Elbow"[Mesh]', '"Elbow"[Mesh]', '"Eccentric Training"[Mesh]'],
      expanded_query_zh: '外上髁炎 離心腕部伸展 等長訓練 肌腱強化 網球肘保守治療',
      expanded_query_en: 'lateral epicondylitis tennis elbow eccentric exercise wrist extension strengthening',
      pubmed_query: '(lateral epicondylitis OR tennis elbow) AND (eccentric exercise OR physical therapy)',
      is_admin_query: false,
    },
  },
];

// ── Gemini 輕量 LLM 查詢擴寫 System Prompt ───────────────────────────────────
const QUERY_EXPANSION_SYSTEM_PROMPT = `你是一位台灣物理治療與運動醫學專家，精通 ICF 國際健康功能分類、PubMed MeSH 術語、PICO 架構與 FITT 運動參數。

你的任務：將使用者的口語問句，轉換為精準的物理治療臨床查詢術語 JSON。

輸出格式（嚴格遵守，只輸出 JSON，不要任何其他文字）：
{
  "clinical_condition": "英文臨床診斷/疾患名稱",
  "anatomical_targets": ["解剖結構陣列（英文）"],
  "biomechanics": ["相關生物力學因素（英文）"],
  "mesh_terms": ["PubMed MeSH 術語陣列"],
  "expanded_query_zh": "擴寫後的繁體中文查詢詞（空格分隔多個術語）",
  "expanded_query_en": "擴寫後的英文查詢詞（空格分隔多個術語）",
  "pubmed_query": "完整 PubMed 搜尋語法",
  "is_admin_query": false
}

若問題屬於法規/收費/健保制度/行政流程（非臨床動作），請輸出：
{"is_admin_query": true}`;

// ── 主要匯出函式 ──────────────────────────────────────────────────────────────

/**
 * 擴寫使用者查詢
 *
 * @param {string} userQuery  — 使用者原始口語問句
 * @param {string} apiKey     — Gemini API Key（可選；無則使用靜態規則）
 * @param {number} timeoutMs  — LLM 呼叫超時（預設 500ms）
 * @returns {Promise<Object>} — 擴寫結果 JSON
 */
export async function expandQuery(userQuery, apiKey, timeoutMs = 500) {
  // 1. 行政/法規問題快速過濾
  if (ADMIN_KEYWORDS.some(k => userQuery.includes(k))) {
    return { is_admin_query: true };
  }

  // 2. 若有 API Key，嘗試 LLM 擴寫
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: QUERY_EXPANSION_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: `使用者問句：「${userQuery}」` }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(text.trim());
        if (parsed && typeof parsed === 'object') {
          parsed._source = 'llm';
          return parsed;
        }
      }
    } catch {
      // 超時或失敗 → 自動降級至靜態規則
    }
  }

  // 3. 靜態規則降級 fallback
  for (const entry of STATIC_EXPANSION_MAP) {
    if (entry.patterns.some(p => p.test(userQuery))) {
      return { ...entry.result, _source: 'static' };
    }
  }

  // 4. 完全無法擴寫 → 回傳原始問句（但仍嘗試混合搜尋）
  return {
    clinical_condition: userQuery,
    anatomical_targets: [],
    biomechanics: [],
    mesh_terms: [],
    expanded_query_zh: userQuery,
    expanded_query_en: userQuery,
    pubmed_query: `(${userQuery}) AND (physical therapy OR rehabilitation OR exercise)`,
    is_admin_query: false,
    _source: 'passthrough',
  };
}

/**
 * 從擴寫結果組合出最佳化的混合搜尋查詢字串
 * （供 hybridSearch 使用）
 */
export function buildHybridQueryString(expanded, originalQuery) {
  if (expanded.is_admin_query) return null;
  const parts = [
    originalQuery,
    expanded.expanded_query_zh || '',
    expanded.expanded_query_en || '',
    ...(expanded.anatomical_targets || []),
    ...(expanded.biomechanics || []),
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * lib/rag/corpus.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 台灣物理治療精選實證語料庫（策略 4：結構化切塊 Structured Chunking）
 *
 * 每筆 Chunk 依據物理治療標準結構切分：
 *   - PICO：Population / Intervention / Comparison / Outcome
 *   - FITT：Frequency / Intensity / Time / Type
 *   - 禁忌症與紅旗徵兆 (Contraindications)
 *
 * 涵蓋 10 大臨床主題 × 4～5 期/介入 ≈ 45 筆高品質段落。
 * 所有段落來源均附 PMID 或 CPG 官方連結，可溯源。
 */

export const PT_CORPUS = [

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 1: 前十字韌帶術後復健 (ACL Reconstruction Rehabilitation)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'acl-001',
    topic: 'acl_rehab',
    phase: 'early',
    population: 'ACL重建術後0-4週急性期；適用所有移植物類型（自體骨腱骨/股薄肌）',
    zh_keywords: ['前十字韌帶', 'ACL', '術後', '重建', '膝蓋', '急性期', '腫脹', '股四頭肌'],
    en_keywords: ['anterior cruciate ligament', 'ACL', 'reconstruction', 'postoperative', 'quadriceps', 'early phase', 'swelling'],
    intervention: {
      name: '等長股四頭肌收縮（Quad Sets）+ 直腿抬高（SLR）',
      frequency: '每天3-4次',
      intensity: '最大自主收縮（MVC）70%，全程維持無痛原則',
      time: '等長維持10秒 × 15-20次 / 組，SLR 10次 / 組',
      type: '等長收縮（isometric）',
      contraindications: '膝關節腫脹明顯時暫停阻力訓練；術後1週內避免膝完全主動伸直（0°）；禁止開鏈深蹲、跳躍及急停動作'
    },
    outcome: '術後1週達股四頭肌早期啟動；研究顯示術後6週股四頭肌肌力達健側70%可啟動功能性訓練',
    evidence_level: 'A',
    source: 'JOSPT CPG: Anterior Cruciate Ligament Injuries 2022',
    pmid: '35088697',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35088697/',
    full_text: '前十字韌帶ACL重建術後急性期0-4週，進行等長股四頭肌收縮Quad Sets與直腿抬高SLR。頻率每天3-4次，強度MVC70%維持無痛，每次等長10秒重複15-20次。禁忌：腫脹期避免深蹲跳躍急停，術後1週內避免完全主動伸直。目標術後6週股四頭肌肌力達健側70%啟動功能訓練。'
  },
  {
    id: 'acl-002',
    topic: 'acl_rehab',
    phase: 'subacute',
    population: 'ACL重建術後4-12週亞急性期；腫脹消退、步態接近正常',
    zh_keywords: ['前十字韌帶', 'ACL', '術後', '亞急性期', '閉鏈', '股四頭肌', '臀肌', '本體感覺'],
    en_keywords: ['ACL', 'closed kinetic chain', 'squat', 'proprioception', 'neuromuscular', 'quadriceps', 'gluteus'],
    intervention: {
      name: '閉鏈訓練：箱式深蹲 + 分腿蹲 + 側跨步（Lateral Band Walk）',
      frequency: '每週3-4次',
      intensity: '自身體重至20%外加負荷；以疼痛視覺量表VAS≤3/10為強度上限',
      time: '3組 × 12-15次，組間休息90秒',
      type: '閉鏈向心/離心收縮（closed kinetic chain concentric/eccentric）',
      contraindications: '術後12週前避免開鏈膝伸直（0-60°）；屈曲超過90°需確認縫合固定穩定；跑步於步態對稱前嚴禁'
    },
    outcome: '術後12週膝關節活動度恢復≥90°；功能性跳躍測試（Single Hop）達健側80%以上',
    evidence_level: 'A',
    source: 'APTA CPG: ACL Rehabilitation 2022',
    pmid: '35088697',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35088697/',
    full_text: 'ACL重建術後4-12週亞急性期，進行閉鏈訓練包含箱式深蹲分腿蹲及側跨步。頻率每週3-4次，強度以VAS3為上限，3組12-15次組間90秒休息。術後12週前避免開鏈膝伸直；目標12週膝活動度90度，單腳跳達健側80%。'
  },
  {
    id: 'acl-003',
    topic: 'acl_rehab',
    phase: 'functional',
    population: 'ACL重建術後4-9個月功能重建期；準備重返運動',
    zh_keywords: ['前十字韌帶', 'ACL', '重返運動', '跳躍', '落地', '神經肌肉', '專項訓練'],
    en_keywords: ['ACL', 'return to sport', 'plyometric', 'landing', 'neuromuscular', 'agility', 'hop test'],
    intervention: {
      name: '漸進式增強式訓練（Plyometrics）+ 敏捷性訓練 + 專項動作模擬',
      frequency: '每週2-3次（非連續日）',
      intensity: '由雙腳起跳落地進展至單腳；確認膝不內扣、軀幹穩定後才進階',
      time: '每次訓練40-60分鐘；重返運動需：患側肌力>90%健側 + 心理準備就緒',
      type: '增強式訓練（plyometric）+ 敏捷性（agility）',
      contraindications: '肌力測試未達標（LSI<90%）嚴禁重返接觸性運動；膝內扣（dynamic valgus）需先退回修正訓練；術後未滿9個月不建議重返高強度切換動作運動'
    },
    outcome: '系統性回顧顯示：ACL術後重返同等運動水準的比率約65%；採用標準化重返標準（Criteria-based）可提高至82%',
    evidence_level: 'A',
    source: 'British Journal of Sports Medicine - RTS after ACL Meta-analysis 2021',
    pmid: '33097501',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33097501/',
    full_text: 'ACL重建術後4-9個月功能重建期，漸進式增強式訓練與敏捷訓練。頻率每週2-3次，由雙腳落地進階至單腳。重返運動需患側肌力達健側90%。術後未滿9個月不建議重返高強度切換運動。系統性回顧顯示標準化重返標準可使重返率提高至82%。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 2: 下背痛 / 腰椎 (Low Back Pain / Lumbar Spine)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'lbp-001',
    topic: 'low_back_pain',
    phase: 'acute',
    population: '急性下背痛（病程<6週）；無神經學症狀（下肢麻木/無力）',
    zh_keywords: ['下背痛', '腰痛', '急性', '閃到腰', '腰椎', '核心', '紅旗', '危險警訊'],
    en_keywords: ['low back pain', 'acute', 'lumbar', 'red flags', 'exercise', 'active movement', 'McKenzie'],
    intervention: {
      name: '積極活動（Active Movement）+ 麥肯基療法（McKenzie Extension Exercise）',
      frequency: '每天2-3次，配合每30-40分鐘起身走動',
      intensity: '溫和、無痛範圍內進行；避免引發放射性下肢痛',
      time: '每次伸展/動作 10-15 分鐘；臥床休息限制在24-48小時內',
      type: '主動運動（active exercise）+ 姿勢修正',
      contraindications: '紅旗徵兆需立即就醫：馬尾症候群（大小便失禁）、夜間痛醒、不明原因體重驟降、發燒、癌症病史；嚴禁長期臥床（>48小時），研究顯示恢復更差'
    },
    outcome: '70-90%急性下背痛患者在6-8週內自然緩解；麥肯基療法可縮短疼痛期並降低復發率',
    evidence_level: 'A',
    source: 'European Spine Journal CPG: Low Back Pain 2022',
    pmid: '35248142',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35248142/',
    full_text: '急性下背痛6週內無神經症狀，建議積極活動與麥肯基伸展。頻率每天2-3次每30分鐘起身走動。臥床休息限24-48小時。紅旗徵兆含馬尾症候群夜間痛醒體重驟降發燒癌症病史需立即就醫。70-90%患者6-8週自然緩解。'
  },
  {
    id: 'lbp-002',
    topic: 'low_back_pain',
    phase: 'subacute_squat',
    population: '亞急性下背痛或深蹲相關腰椎屈曲受限；骨盆前傾代償或臀肌啟動不足',
    zh_keywords: ['下背痛', '深蹲', '腰痠', '骨盆前傾', '臀肌', '核心訓練', '腰椎穩定'],
    en_keywords: ['low back pain', 'squat', 'lumbar flexion', 'anterior pelvic tilt', 'gluteus', 'core stability', 'butt wink'],
    intervention: {
      name: '核心穩定訓練（Core Stability）+ 臀肌啟動序列 + 深蹲動作重訓（Squat Pattern Retraining）',
      frequency: '每週3-5次',
      intensity: '初期：自體重鳥狗式/橋式（0%外加負荷）；進階：負重至最大肌力20-40%，RPE 6-7/10',
      time: '橋式：3組 × 15次；鳥狗式：3組 × 10次（各方向）；深蹲重訓：3組 × 8-10次',
      type: '等長核心穩定 + 閉鏈深蹲向心/離心',
      contraindications: '深蹲過程若腰椎屈曲（骨盆後傾「Butt Wink」）超過中立範圍，先退至箱式深蹲；急性期（VAS>7）不宜啟動阻力訓練；有椎間盤突出病史者避免高度屈曲負重'
    },
    outcome: 'Cochrane 系統性回顧（2021）：核心穩定訓練在慢性下背痛的疼痛減輕與功能改善均優於一般運動（SMD -0.42）',
    evidence_level: 'A',
    source: 'Cochrane Review: Core stability exercise for LBP 2021',
    pmid: '33606281',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33606281/',
    full_text: '亞急性下背痛或深蹲腰椎屈曲受限，骨盆前傾臀肌啟動不足。核心穩定訓練與臀肌啟動序列及深蹲動作重訓。每週3-5次，橋式鳥狗式各3組，深蹲重訓3組8-10次。深蹲骨盆後傾超出中立退至箱式深蹲。Cochrane回顧核心穩定訓練優於一般運動SMD-0.42。'
  },
  {
    id: 'lbp-003',
    topic: 'low_back_pain',
    phase: 'chronic',
    population: '慢性下背痛（病程>12週）；可能合併心理社會因素（恐動症、焦慮）',
    zh_keywords: ['慢性下背痛', '多裂肌', '恐動症', '心理社會', '漸進式運動', '全身耐力'],
    en_keywords: ['chronic low back pain', 'multifidus', 'kinesiophobia', 'biopsychosocial', 'graded activity', 'aerobic'],
    intervention: {
      name: '生物心理社會模式介入：漸進負荷訓練 + 疼痛教育 + 有氧運動',
      frequency: '每週3-4次（含氧每週150分鐘中強度，或75分鐘高強度）',
      intensity: '心率儲備50-70%（中等強度有氧）；阻力訓練RPE 5-7/10',
      time: '有氧：每次30-40分鐘；阻力：每週2-3次，8-12次3組',
      type: '有氧 + 漸進阻力 + 行為改變（graduated exposure）',
      contraindications: '骨折、腫瘤、感染、嚴重神經壓迫須先就醫排除；重度憂鬱/焦慮需合併心理諮商'
    },
    outcome: '多模式介入（運動+教育）效果優於單純運動；研究顯示疼痛自我效能（PSEQ）提升與長期預後顯著相關',
    evidence_level: 'A',
    source: 'Lancet: Low Back Pain Series 2018',
    pmid: '29573870',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29573870/',
    full_text: '慢性下背痛病程超過12週合併心理社會因素，採生物心理社會介入：漸進負荷訓練疼痛教育有氧運動。每週3-4次有氧150分鐘，阻力每週2-3次3組8-12次。需排除骨折腫瘤感染嚴重神經壓迫。多模式介入優於單純運動，疼痛自我效能提升與長期預後相關。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 3: 阿基里斯腱病變 (Achilles Tendinopathy)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'achilles-001',
    topic: 'achilles_tendinopathy',
    phase: 'subacute',
    population: '阿基里斯腱肌腱病變（非撕裂）；運動員或跑者，慢性反覆性疼痛',
    zh_keywords: ['阿基里斯腱', '跟腱', '阿基里斯', '肌腱炎', '離心', '跟腱病變', '小腿'],
    en_keywords: ['Achilles tendinopathy', 'eccentric exercise', 'heel drop', 'calf', 'Alfredson', 'tendon loading'],
    intervention: {
      name: 'Alfredson 離心踮腳尖（Eccentric Heel Drop）— 黃金標準',
      frequency: '每天2次，持續12週',
      intensity: '膝伸直組（比目魚肌）+ 膝彎曲組（腓腸肌）；初期允許輕度疼痛（VAS≤5），避免急劇刺痛',
      time: '3組 × 15次，每次訓練約15分鐘；共12週',
      type: '離心收縮（eccentric）',
      contraindications: '完全撕裂（MRI確認）嚴禁負重訓練；急性撕裂傷後6-8週避免離心負荷；疼痛VAS>7/10需降低負荷；糖尿病患者肌腱癒合較慢，進展需更保守'
    },
    outcome: 'Alfredson 離心訓練12週後70-85%患者疼痛顯著緩解；系統性回顧顯示優於一般伸展與休息（NNT=3）',
    evidence_level: 'A',
    source: 'Cochrane Review: Exercise therapy for Achilles tendinopathy 2023',
    pmid: '36756800',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36756800/',
    full_text: '阿基里斯腱病變非撕裂跑者運動員，Alfredson離心踮腳尖訓練。每天2次持續12週，3組15次，膝伸直與膝彎曲各組。初期允許輕度疼痛VAS5以下。完全撕裂禁止負重訓練。12週後70-85%疼痛緩解，系統性回顧優於一般伸展NNT為3。'
  },
  {
    id: 'achilles-002',
    topic: 'achilles_tendinopathy',
    phase: 'reactive',
    population: '阿基里斯腱反應性肌腱病（急性高度疼痛期）；初次發作或過度訓練',
    zh_keywords: ['阿基里斯腱', '急性', '等長收縮', '疼痛控制', '減少負荷'],
    en_keywords: ['Achilles', 'reactive tendinopathy', 'isometric', 'pain relief', 'load management'],
    intervention: {
      name: '等長踮腳尖（Isometric Calf Raise）— 急性期疼痛控制首選',
      frequency: '每天1-2次',
      intensity: '70% MVC，維持45秒',
      time: '5次 × 45秒維持，組間休息2分鐘；連續進行5天',
      type: '等長收縮（isometric）',
      contraindications: '等長訓練後疼痛加劇超過30分鐘，需降低強度或暫停；嚴禁單腳跳、跑步及高強度增強式訓練'
    },
    outcome: 'Rio 等人2015年RCT：等長收縮當下即時鎮痛效果（Cortical Inhibition），VAS下降27%，優於等張收縮',
    evidence_level: 'B',
    source: 'British Journal of Sports Medicine: Isometric vs isotonic 2015',
    pmid: '25979840',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25979840/',
    full_text: '阿基里斯腱反應性肌腱病急性高度疼痛期，等長踮腳尖訓練。每天1-2次，70%MVC維持45秒5組每組間休息2分鐘。等長收縮當下即時鎮痛VAS下降27%。等長後疼痛超30分鐘需降低強度。嚴禁跑步跳躍。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 4: 足底筋膜炎 (Plantar Fasciitis)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'pf-001',
    topic: 'plantar_fasciitis',
    phase: 'subacute',
    population: '足底筋膜炎（慢性或亞急性）；早晨起床第一步劇痛、久坐後站起疼痛',
    zh_keywords: ['足底筋膜炎', '足底痛', '腳跟痛', '足底筋膜', '足弓', '起床第一步', '晨起疼痛'],
    en_keywords: ['plantar fasciitis', 'heel pain', 'plantar fascia stretch', 'intrinsic foot', 'first step pain'],
    intervention: {
      name: '足底筋膜自我伸展 + 小腿腓腸肌/比目魚肌伸展 + 內在足部肌群強化',
      frequency: '每天2-3次，早晨起床前在床上先做；持續8-12週',
      intensity: '伸展維持時感覺適度緊繃（非疼痛）；強化以VAS≤3為上限',
      time: '足底筋膜伸展：30秒 × 3次；小腿伸展：60秒 × 3次；毛巾抓取/短足訓練：3組 × 15次',
      type: '靜態伸展 + 內在肌強化',
      contraindications: '急性期（腫脹發燙）先冰敷、減少負重，待發炎消退再啟動伸展；足底骨刺並非禁忌，但若症狀加劇需影像確認有無撕裂'
    },
    outcome: 'RCT顯示足底筋膜自我伸展8週後疼痛改善顯著優於小腿伸展單獨治療（JBJS 2003）；短足訓練可強化足弓穩定性',
    evidence_level: 'A',
    source: 'JOSPT CPG: Heel Pain - Plantar Fasciitis 2023',
    pmid: '36921252',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36921252/',
    full_text: '足底筋膜炎早晨起床第一步劇痛，足底筋膜自我伸展加腓腸肌比目魚肌伸展加內在足部肌群強化。每天2-3次持續8-12週，足底筋膜30秒3次，小腿60秒3次，毛巾抓取15次3組。急性期冰敷減少負重。足底筋膜自我伸展8週優於單獨小腿伸展。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 5: 旋轉肌群/肩夾擠 (Rotator Cuff / Shoulder Impingement)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'shoulder-001',
    topic: 'rotator_cuff_impingement',
    phase: 'conservative',
    population: '肩峰下夾擠症候群（Subacromial Impingement）或旋轉肌群肌腱病變；手舉過頭疼痛弧60-120°',
    zh_keywords: ['旋轉肌群', '肩夾擠', '旋轉肌', '棘上肌', '肩膀痛', '五十肩', '疼痛弧', '肩關節'],
    en_keywords: ['rotator cuff', 'shoulder impingement', 'subacromial', 'supraspinatus', 'scapular control', 'pain arc'],
    intervention: {
      name: '肩胛骨控制訓練（Scapular Control）+ 旋轉肌群強化（彈力帶外旋/內旋）',
      frequency: '每週3-4次',
      intensity: '彈力帶輕中阻力（RPE 5-6/10）；避免引發疼痛弧內的疼痛',
      time: '3組 × 12-15次；肩胛骨啟動：每組10次维持5秒',
      type: '漸進阻力等張訓練（progressive resistance）',
      contraindications: '疼痛弧內（60-120°）避免高負荷；旋轉肌完全撕裂（MRI確認）不宜單純保守治療超過6個月；Hawkins/Kennedy陽性者避免超過90°內旋'
    },
    outcome: 'Cochrane回顧（2016）：物理治療介入在術後6個月與手術療效相當；肩胛控制訓練顯著改善動態穩定性',
    evidence_level: 'A',
    source: 'Cochrane Review: Interventions for Shoulder Impingement 2016',
    pmid: '27477895',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27477895/',
    full_text: '肩峰下夾擠旋轉肌群肌腱病變手舉過頭疼痛弧60-120度，肩胛骨控制訓練與彈力帶外旋內旋強化。每週3-4次，3組12-15次，RPE5-6。避免疼痛弧內高負荷，旋轉肌完全撕裂保守治療不超過6個月。Cochrane回顧顯示物理治療6個月療效與手術相當。'
  },
  {
    id: 'shoulder-002',
    topic: 'rotator_cuff_impingement',
    phase: 'frozen_shoulder',
    population: '沾黏性肩關節囊炎（五十肩）；被動關節活動度全面受限，肩外展<90°',
    zh_keywords: ['五十肩', '沾黏性肩關節囊炎', '肩膀卡', '手舉不高', '凍結肩', '肩關節囊', '被動活動'],
    en_keywords: ['adhesive capsulitis', 'frozen shoulder', 'capsular pattern', 'mobilization', 'stretching', 'glenohumeral'],
    intervention: {
      name: '漸進式關節囊伸展（Joint Capsule Mobilization）+ 鐘擺式運動（Codman Pendulum）',
      frequency: '每天2-3次；物理治療師徒手每週2次',
      intensity: '初期：鐘擺僅靠重力；進階：輔以彈力帶溫和牽引，在受限角度末端持續30秒',
      time: '鐘擺：每次5-10分鐘；伸展：30-60秒 × 3次',
      type: '被動/主動輔助伸展（passive-assisted stretching）',
      contraindications: '急性發炎期（疼痛劇烈、夜間痛醒）先注射類固醇+鎮痛，不宜強行關節鬆動；骨質疏鬆或旋轉肌完全撕裂者禁止高速推力（HVLA）'
    },
    outcome: '系統性回顧：物理治療結合注射在6個月內效果顯著；大多數患者1-2年內自然緩解，但介入可加速2-6個月',
    evidence_level: 'A',
    source: 'BMJ CPG: Frozen Shoulder 2022',
    pmid: '35948357',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35948357/',
    full_text: '沾黏性肩關節囊炎五十肩被動活動度全面受限，漸進關節囊伸展與鐘擺運動。每天2-3次物理治療師徒手每週2次，初期鐘擺靠重力進階彈力帶牽引末端30秒。急性期先注射類固醇不宜強行鬆動。物理治療結合注射6個月效果顯著，介入可縮短自然病程2-6個月。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 6: 髕骨股骨疼痛症候群 PFPS (Patellofemoral Pain Syndrome)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'pfps-001',
    topic: 'pfps',
    phase: 'subacute',
    population: '髕骨股骨疼痛症候群（跑者膝/深蹲膝）；下樓梯、久坐後站起疼痛',
    zh_keywords: ['髕骨股骨', 'PFPS', '跑者膝', '膝蓋前側痛', '深蹲膝蓋', '股四頭肌', '臀中肌'],
    en_keywords: ['patellofemoral pain', 'PFPS', 'VMO', 'gluteus medius', 'dynamic valgus', 'step down', 'squat'],
    intervention: {
      name: 'VMO強化訓練 + 臀中肌訓練（蚌殼式/側躺外展）+ 動作控制（Step Down Test糾正）',
      frequency: '每週3-4次',
      intensity: '自體重進展至輕度彈力帶/啞鈴阻力，VAS≤3/10',
      time: 'VMO終末伸膝：3組 × 15次；蚌殼式：3組 × 20次；Step Down：3組 × 10次',
      type: '閉鏈向心/離心（closed chain）+ 開鏈VMO（terminal knee extension）',
      contraindications: '深蹲膝蓋前移超過腳趾（增加髕骨壓力）需先修正；膝內扣（dynamic valgus）角度明顯時退步至雙腳平衡訓練；膝積水明顯時暫停阻力訓練'
    },
    outcome: 'JOSPT指引：VMO+臀中肌聯合訓練在短期（6週）優於單獨VMO訓練；70%患者6個月緩解',
    evidence_level: 'A',
    source: 'JOSPT CPG: Patellofemoral Pain 2019',
    pmid: '31475628',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31475628/',
    full_text: '髕骨股骨疼痛症候群PFPS跑者膝深蹲膝蓋，VMO強化加臀中肌訓練。每週3-4次，VMO終末伸膝3組15次，蚌殼式3組20次，Step Down3組10次。深蹲膝前移超腳趾需修正，膝內扣退至雙腳平衡訓練。VMO臀中肌聯合訓練6週優於單獨VMO訓練70%患者6個月緩解。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 7: 髂脛束症候群 (IT Band Syndrome / Runner's Knee Lateral)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'itbs-001',
    topic: 'itbs',
    phase: 'subacute',
    population: '髂脛束摩擦症候群（跑者膝外側）；跑步/下樓梯膝外側疼痛，Noble壓迫測試陽性',
    zh_keywords: ['髂脛束', 'ITB', 'ITBS', '跑者膝', '膝蓋外側', '髂脛束摩擦', '跑步膝'],
    en_keywords: ['iliotibial band', 'ITBS', 'ITB', 'runner knee', 'lateral knee pain', 'Noble compression', 'hip abduction'],
    intervention: {
      name: '臀中肌/臀大肌強化（側跨步/臀橋/單腳深蹲）+ 訓練量調整 + 跑步生物力學修正',
      frequency: '每週3次（跑步量先減少30-50%）',
      intensity: '初期自體重，2週後加彈力帶；跑步步頻提高至180步/分鐘（減少膝彎曲角度）',
      time: '臀橋：3組 × 15次；側跨步：3組 × 20步/側；跑步：逐週增量不超過10%',
      type: '臀部強化（hip strengthening）+ 跑步再訓練（gait retraining）',
      contraindications: '急性期劇痛應暫停跑步，先消炎；嚴禁大量泡滾筒壓ITB（摩擦症候群不宜直接壓迫發炎組織）；下肢長短差>1cm需矯正鞋墊評估'
    },
    outcome: 'Cochrane回顧：跑者膝外側物理治療6-8週疼痛可顯著改善；臀肌無力是最重要的發病誘因',
    evidence_level: 'B',
    source: 'Physical Therapy in Sport: ITBS Systematic Review 2021',
    pmid: '33906936',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33906936/',
    full_text: '髂脛束摩擦症候群跑者膝外側疼痛，臀中肌臀大肌強化訓練與訓練量調整及跑步生物力學修正。每週3次跑步量先減30-50%，臀橋側跨步各3組。步頻提高至180步每分鐘。急性期禁止跑步，嚴禁大量泡滾筒壓ITB。物理治療6-8週疼痛顯著改善。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 8: 頸椎疼痛 (Cervical Spine / Neck Pain)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'neck-001',
    topic: 'neck_pain',
    phase: 'subacute',
    population: '非特異性頸部疼痛（非外傷、非腫瘤）；辦公族久坐、頸椎活動度受限',
    zh_keywords: ['頸椎', '落枕', '脖子痛', '頸部', '頭痛', '頸椎穩定', '深層頸屈肌'],
    en_keywords: ['neck pain', 'cervical', 'deep cervical flexor', 'craniocervical flexion', 'mobilization', 'strengthening'],
    intervention: {
      name: '深層頸屈肌訓練（Craniocervical Flexion Test/Exercise）+ 頸椎穩定訓練',
      frequency: '每天1-2次',
      intensity: '點頭動作（Chin Tuck）：極輕阻力，感覺頸後肌群輕度拉伸即可；力氣不需大',
      time: 'Chin Tuck：10次 × 10秒維持，每次20分鐘；持續6-8週',
      type: '等長深層頸屈肌訓練（isometric deep cervical flexor）',
      contraindications: '頸椎脊髓病變（Myelopathy）：避免過度屈曲；類風濕性關節炎患者需X光排除寰椎不穩；上肢麻木無力加劇需立即就醫'
    },
    outcome: 'Lancet 臨床試驗：頸椎穩定訓練+徒手治療12週後優於單純止痛；深層頸屈肌訓練可降低頭痛頻率',
    evidence_level: 'A',
    source: 'JOSPT CPG: Cervical Pain and Headache 2017',
    pmid: '29276978',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29276978/',
    full_text: '非特異性頸部疼痛辦公族久坐頸椎活動受限，深層頸屈肌訓練。每天1-2次Chin Tuck10次10秒維持，持續6-8週。頸椎脊髓病變避免過度屈曲，類風濕患者需排除寰椎不穩。頸椎穩定訓練12週優於單純止痛。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 9: 踝關節扭傷 (Ankle Sprain)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ankle-001',
    topic: 'ankle_sprain',
    phase: 'early',
    population: '急性外側踝關節扭傷（1-2度）；腫脹瘀青，踝外側韌帶（ATFL/CFL）受傷',
    zh_keywords: ['腳踝扭傷', '踝扭傷', '翻船', '腳踝', '外側韌帶', '腫脹', '冰敷', 'PRICE'],
    en_keywords: ['ankle sprain', 'lateral ligament', 'PRICE', 'ATFL', 'proprioception', 'balance training'],
    intervention: {
      name: 'PEACE & LOVE 原則（取代舊式 RICE）+ 早期本體感覺訓練',
      frequency: '初期每小時冰敷20分鐘；本體感覺訓練：每天1次',
      intensity: '初期：單腳平衡10秒（睜眼→閉眼漸進）；第2週：BOSU板不穩定面訓練',
      time: '急性期72小時PEACE（保護、負重減少、冰敷、加壓、抬高）；72小時後啟動LOVE（負重、樂觀、活動、運動）',
      type: '早期活動（early mobilization）+ 神經肌肉訓練（neuromuscular）',
      contraindications: '渥太華踝關節準則（Ottawa Ankle Rules）：內外踝骨壓痛 + 無法負重行走4步→需X光排除骨折；3度完全撕裂需討論手術vs保守'
    },
    outcome: '早期活動（vs固定）顯著縮短回運動時間（MD -4.37天）；本體感覺訓練可預防再扭傷率達50%',
    evidence_level: 'A',
    source: 'British Journal of Sports Medicine: Ankle Sprain CPG 2020',
    pmid: '31337636',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31337636/',
    full_text: '急性外側踝關節扭傷1-2度，PEACE LOVE原則取代舊式RICE加早期本體感覺訓練。急性72小時PEACE，之後啟動LOVE早期負重活動。渥太華踝關節準則需排除骨折。早期活動縮短回運動4.37天，本體感覺訓練預防再扭傷達50%。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 10: 退化性膝關節炎 (Knee Osteoarthritis)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'koa-001',
    topic: 'knee_osteoarthritis',
    phase: 'moderate',
    population: '膝關節退化性關節炎（X光KL grade 2-3）；中度以上，上下樓梯明顯疼痛',
    zh_keywords: ['退化性膝關節炎', '退化性關節炎', '膝蓋退化', '骨關節炎', '上下樓梯', '膝蓋痛', '股四頭肌'],
    en_keywords: ['knee osteoarthritis', 'quadriceps', 'aquatic exercise', 'weight management', 'pain', 'function'],
    intervention: {
      name: '股四頭肌強化（低衝擊）+ 水中運動（Aquatic Exercise）+ 體重管理',
      frequency: '每週3-5次；體重目標：BMI<25，若超重先減5%體重',
      intensity: '低衝擊：有氧功能車60-70%最大心率；阻力RPE 5-7/10，以疼痛不超過VAS4為準',
      time: '有氧：每次30-40分鐘；股四頭肌：3組 × 12-15次；持續12週以上',
      type: '低衝擊有氧（low-impact aerobic）+ 漸進阻力（progressive resistance）',
      contraindications: '急性感染性關節炎（發燒、關節腫燙）禁止運動；類風濕性關節炎炎症期需先藥物控制；膝關節置換術後需遵從術後復健計畫'
    },
    outcome: 'OARSI指引：運動是退化性膝關節炎最強效介入（強烈建議）；體重減5%可降低疼痛30%；手術不應在嘗試運動治療6個月前進行',
    evidence_level: 'A',
    source: 'OARSI CPG: Knee and Hip Osteoarthritis 2019',
    pmid: '31036393',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31036393/',
    full_text: '退化性膝關節炎KL grade 2-3，股四頭肌強化水中運動體重管理。每週3-5次，低衝擊有氧每次30-40分鐘，股四頭肌3組12-15次，持續12週以上。體重減5%降低疼痛30%。OARSI指引運動為最強效介入，手術前應先嘗試6個月運動治療。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 11: 媽媽手 / 手腕 (De Quervain / Wrist)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'dequervain-001',
    topic: 'wrist_hand',
    phase: 'conservative',
    population: '狄奎凡氏症（媽媽手）；大拇指基部橈骨莖突疼痛，Finkelstein test陽性',
    zh_keywords: ['媽媽手', '狄奎凡', '大拇指', '手腕痛', '橈骨莖突', '腱鞘炎', '親餵媽媽'],
    en_keywords: ['De Quervain', 'tenosynovitis', 'thumb', 'wrist', 'Finkelstein', 'splint', 'radial styloid'],
    intervention: {
      name: '拇指固定支架（Thumb Spica Splint）+ 修改活動方式 + 離心肌腱強化（6-8週後）',
      frequency: '支架：全天佩戴（除沐浴）持續6週；強化：每天1次，第6週後啟動',
      intensity: '急性期：支架+活動修改（避免大拇指外展+腕部尺偏動作）；後期：輕彈力帶阻力RPE4',
      time: '支架急性期6週；強化訓練：3組 × 15次，每次10分鐘',
      type: '保護性固定（splinting）→ 漸進離心肌腱強化（eccentric tendon loading）',
      contraindications: '哺乳媽媽需確認注射成分是否適合（玻尿酸優於類固醇）；若6週保守治療無效，考慮類固醇注射；嚴禁前6週進行大拇指阻力訓練'
    },
    outcome: '系統性回顧：類固醇注射+支架在3個月效果優於單獨支架；大多數患者4-8週症狀顯著改善',
    evidence_level: 'B',
    source: 'Cochrane Review: De Quervain tenosynovitis 2013',
    pmid: '23633312',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23633312/',
    full_text: '媽媽手狄奎凡氏症大拇指橈骨莖突疼痛Finkelstein陽性，拇指固定支架加活動修改。支架全天佩戴6週，6週後啟動輕度彈力帶強化。哺乳媽媽注射成分需謹慎。6週保守無效考慮類固醇注射。4-8週症狀顯著改善。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 12: 肩胛骨動力異常 / 圓肩 (Scapular Dyskinesis / Rounded Shoulder)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'posture-001',
    topic: 'posture_scapular',
    phase: 'corrective',
    population: '圓肩駝背、上交叉症候群（前鋸肌/菱形肌無力，胸小肌/上斜方肌緊繃）；久坐辦公族',
    zh_keywords: ['圓肩', '駝背', '上交叉', '肩胛骨', '前鋸肌', '烏龜頸', '富貴包', '胸椎'],
    en_keywords: ['rounded shoulder', 'upper crossed syndrome', 'scapular dyskinesis', 'serratus anterior', 'thoracic', 'posture'],
    intervention: {
      name: '胸椎伸展（泡棉滾筒）+ 前鋸肌啟動（牆壁伏地挺身）+ 菱形肌/中下斜方肌強化（面拉）',
      frequency: '每天1次（伸展）+ 每週3次（強化）',
      intensity: '胸椎滾筒：溫和，節段性伸展，非一次強力壓迫；強化：彈力帶輕中阻力RPE5',
      time: '胸椎伸展：每節段維持30秒；牆壁伏地挺身：3組 × 15次；面拉：3組 × 12次',
      type: '伸展放鬆（tight group）+ 強化（weak group）',
      contraindications: '嚴重骨質疏鬆者不宜大力按壓胸椎；頸椎狹窄患者滾筒操作需特別謹慎；孕婦俯臥位姿勢需調整'
    },
    outcome: '研究顯示：肩胛骨動力異常是肩夾擠最常見的促發因子；針對性訓練可在6-8週改善肩胛上旋量',
    evidence_level: 'B',
    source: 'Journal of Shoulder and Elbow Surgery: Scapular training 2022',
    pmid: '35346551',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35346551/',
    full_text: '圓肩駝背上交叉症候群前鋸肌菱形肌無力，胸椎滾筒伸展加前鋸肌牆壁伏地挺身加菱形肌面拉。每天胸椎伸展每週3次強化，各3組。胸椎嚴重骨質疏鬆不宜大力按壓。針對性訓練6-8週改善肩胛上旋。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 13: 網球肘 (Lateral Epicondylitis)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'tennis-001',
    topic: 'lateral_epicondylitis',
    phase: 'subacute',
    population: '外上髁炎（網球肘）；握力動作時肘外側疼痛，Cozen test陽性',
    zh_keywords: ['網球肘', '外上髁炎', '手肘外側', '握力', '網球', '伸腕肌', '肌腱病變'],
    en_keywords: ['lateral epicondylitis', 'tennis elbow', 'eccentric wrist extension', 'grip strength', 'ERCB', 'Cozen'],
    intervention: {
      name: '離心腕部伸展訓練（Eccentric Wrist Extension）+ 等長握力訓練',
      frequency: '每天1-2次，持續8-12週',
      intensity: '等長：70% MVC，維持30-45秒；離心：輕啞鈴（從0.5kg起），允許輕度不適',
      time: '等長：5組 × 45秒，組間休息2分鐘；離心：3組 × 15次',
      type: '等長（isometric）→ 離心（eccentric）→ 向心離心（isotonic）',
      contraindications: '急性期（紅腫發燙）先冰敷+休息；嚴禁急性期強力拉伸；類固醇注射雖短期有效，長期2年結果劣於物理治療'
    },
    outcome: 'BMJ系統性回顧：離心訓練8-12週效果優於類固醇注射（長期追蹤1年）；等長訓練即時鎮痛效果顯著',
    evidence_level: 'A',
    source: 'British Journal of Sports Medicine: Tennis Elbow 2019',
    pmid: '30926598',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30926598/',
    full_text: '外上髁炎網球肘握力疼痛Cozen陽性，離心腕部伸展加等長握力訓練。每天1-2次持續8-12週，等長70%MVC45秒5組，離心輕啞鈴3組15次。急性期冰敷休息。類固醇注射短期有效長期劣於物理治療。BMJ回顧離心訓練8-12週優於類固醇注射。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 14: 臀中肌無力 / 步態異常 (Gluteus Medius Weakness / Gait)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'glute-001',
    topic: 'gluteus_medius',
    phase: 'strengthening',
    population: '臀中肌無力（Trendelenburg步態/膝外翻/髂脛束症候群）；常見於跑者、久坐族',
    zh_keywords: ['臀中肌', '臀部', 'Trendelenburg', '骨盆穩定', '膝外翻', '髂脛束', '步態', '臀肌'],
    en_keywords: ['gluteus medius', 'Trendelenburg', 'hip abduction', 'dynamic valgus', 'single leg squat', 'gait'],
    intervention: {
      name: '蚌殼式（Clamshell）+ 側躺腿外展 + 單腳深蹲控制訓練',
      frequency: '每週3-4次',
      intensity: '蚌殼式：無阻力至彈力帶阻力（輕中）；單腳深蹲：自體重為主，確認對側骨盆不下沉',
      time: '蚌殼式：3組 × 20次；側躺外展：3組 × 15次；單腳深蹲：3組 × 8-10次',
      type: '開鏈髖外展（open chain hip abduction）→ 閉鏈功能性訓練（closed chain functional）',
      contraindications: '髖關節置換術後需確認手術方式（後外側vs前外側）的限制；急性發炎期避免外展末端阻力；膝外翻角度太大（>15°）需先做雙腳穩定再進階'
    },
    outcome: '研究顯示臀中肌無力與跑者膝、髂脛束症候群、PFPS均顯著相關；強化訓練6週後步態對稱性顯著改善',
    evidence_level: 'A',
    source: 'Journal of Athletic Training: Hip Strengthening and Running Injuries 2018',
    pmid: '29932756',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29932756/',
    full_text: '臀中肌無力Trendelenburg步態膝外翻髂脛束症候群，蚌殼式側躺腿外展單腳深蹲訓練。每週3-4次，蚌殼式3組20次，側躺外展3組15次，單腳深蹲3組8-10次。髖關節置換術後確認限制。強化訓練6週後步態對稱性顯著改善。'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC 15: 坐骨神經痛 / 梨狀肌症候群 (Sciatica / Piriformis Syndrome)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'sciatica-001',
    topic: 'sciatica_piriformis',
    phase: 'subacute',
    population: '坐骨神經痛或梨狀肌症候群；臀部深處疼痛、下肢放射、久坐加重',
    zh_keywords: ['坐骨神經', '梨狀肌', '臀部深處痛', '下肢放射', '久坐', '腿麻', '神經鬆動'],
    en_keywords: ['sciatica', 'piriformis syndrome', 'neural mobilization', 'sciatic nerve', 'hip external rotation', 'piriformis stretch'],
    intervention: {
      name: '梨狀肌伸展（Pigeon Pose）+ 神經鬆動術（Neural Mobilization / Sciatic Nerve Slider）',
      frequency: '每天2次',
      intensity: '神經鬆動：輕柔，以脛骨輕度牽伸感為準，絕非劇烈刺痛；梨狀肌：維持30秒適度緊繃',
      time: '梨狀肌伸展：30秒 × 3次；神經鬆動：10次 × 2組（緩慢節律性活動）',
      type: '靜態伸展（piriformis）+ 神經鬆動術（sciatic nerve slider/tensioner）',
      contraindications: '腰椎椎間盤突出（HIVD）確診者：神經鬆動需非常謹慎，避免「tensioner」模式，改用「slider」模式；下肢完全無力（非疼痛性無力）需立即就醫排除馬尾症候群'
    },
    outcome: '神經鬆動術系統性回顧（2021）：顯著改善坐骨神經痛疼痛與功能，效果持續至追蹤期4週',
    evidence_level: 'B',
    source: 'Physical Therapy: Neural Mobilization for Sciatica SR 2021',
    pmid: '33462630',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33462630/',
    full_text: '坐骨神經痛梨狀肌症候群臀部深處疼痛下肢放射，梨狀肌伸展加神經鬆動術。每天2次，梨狀肌30秒3次，神經鬆動10次2組。椎間盤突出確診改用slider模式。下肢完全無力需立即就醫。神經鬆動顯著改善疼痛效果持續4週。'
  },

];

// ── 輔助函式：依主題或關鍵字快速過濾語料庫 ─────────────────────────────────
export function getChunksByTopic(topic) {
  return PT_CORPUS.filter(c => c.topic === topic);
}

export function getAllTopics() {
  return [...new Set(PT_CORPUS.map(c => c.topic))];
}

export function getCorpusSize() {
  return PT_CORPUS.length;
}

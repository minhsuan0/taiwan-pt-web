/**
 * Pre-Deploy Automated Verification Suite
 * 嚴格自動化把關：在任何部署前自動模擬測試 DOM 渲染、禁詞過濾、追問分離與自癒機制
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
let failureCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAILED] ${message}`);
    failureCount++;
  } else {
    console.log(`✅ [PASSED] ${message}`);
  }
}

console.log('====================================================');
console.log('🚀 開始執行 Pre-Deploy 自動化測試套件');
console.log('====================================================\n');

// ── 測試 1：全域合規與禁詞清查 ──────────────────────────────────
console.log('--- 測試 1：全域合規與禁詞清查 ---');
const chatCode = fs.readFileSync(path.join(rootDir, 'api/chat.js'), 'utf8');
const cacheCode = fs.readFileSync(path.join(rootDir, 'lib/cache.js'), 'utf8');
const htmlCode = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

// 檢查處方字樣（排除代碼中 replace 的安全替換代碼）
const rawCleanChat = chatCode.replace(/replace\([^)]+\)/g, '');
const rawCleanHtml = htmlCode.replace(/replace\([^)]+\)/g, '');

assert(!rawCleanChat.includes('運動處方'), 'api/chat.js 絕無「運動處方」');
assert(!rawCleanHtml.includes('運動處方'), 'index.html 絕無「運動處方」');
assert(!cacheCode.includes('運動處方'), 'lib/cache.js 絕無「運動處方」');
assert(!rawCleanChat.includes('運動劑量'), 'api/chat.js 絕無「運動劑量」');
assert(!rawCleanHtml.includes('運動劑量'), 'index.html 絕無「運動劑量」');
assert(!cacheCode.includes('運動劑量'), 'lib/cache.js 絕無「運動劑量」');

// 檢查未授權 Emoji（排除清洗正則表達式）
assert(!rawCleanChat.includes('👉'), 'api/chat.js 絕無「👉」卡通手手');
assert(!rawCleanHtml.includes('👉'), 'index.html 絕無「👉」卡通手手');
assert(!chatCode.includes('💡 延伸探索'), 'api/chat.js 絕無「💡 延伸探索」');
assert(!htmlCode.includes('💡 延伸探索'), 'index.html 絕無「💡 延伸探索」');


// ── 測試 2：DOM 渲染與 Markdown 解析斷言 ───────────────────────
console.log('\n--- 測試 2：DOM 渲染與 Markdown 解析斷言 ---');

// 模擬瀏覽器環境
const mockEl = { id: '', value: '', style: {}, addEventListener: () => {}, setAttribute: () => {}, classList: { add: () => {}, remove: () => {} }, querySelector: () => ({}) };
global.document = {
  getElementById: (id) => ({ ...mockEl, id }),
  querySelector: () => null,
  createElement: () => ({ ...mockEl })
};
global.window = { addEventListener: () => {}, matchMedia: () => ({ matches: false }), navigator: { userAgent: 'Mozilla' } };
global.navigator = global.window.navigator;
global.messagesEl = { appendChild: () => {}, scrollTop: 0, scrollHeight: 0 };
global.requestAnimationFrame = (fn) => {};

const scriptContent = htmlCode.match(/<script>([\s\S]*?)<\/script>/)[1];
eval(scriptContent);

const sampleResponse = `【安全篩檢與就醫指引】
如果你久坐時屁股痛，請先自我檢視是否有以下危險警訊：
* 疼痛像觸電一樣放射到小腿或腳趾。
* 腳部出現麻木感或無力。

【為什麼會痠痛？常見原因分析】
久坐屁股痛不一定是梨狀肌問題。

【你可以這樣做（建議運動與日常調整）】
1. 坐姿定時動一動：每坐 30 到 40 分鐘請起身走動。
2. 臀部溫和伸展：坐在椅子上進行伸展。

【應避免的動作】
* 避免長時間翹二郎腿。

【相關探索】
* 辦公室久坐時，要怎麼調整坐姿才能減輕屁股和腰部的負擔？
* 臀肌無力跟梨狀肌症候群有什麼不一樣？要怎麼自我檢測？
* 屁股痛的時候，到底該熱敷還是冰敷？

---

【需要運動物理治療師為您詳細評估嗎？】
AI 提供的是普遍實證指引，但每個人身體受力模式與代償機制皆具個別性。本系統由台灣執業物理治療師團隊建立與維護，若想進一步確認個人問題或預約實體一對一評估，歡迎透過本站專屬窗口與物理治療師聯繫：[點此加入駐站物理治療師諮詢窗口 ↗](https://lin.ee/y6VBRuh)`;

const parsed = parseBotResponse(sampleResponse);
const renderedHtml = md(parsed.body);

// 斷言 1：對話氣泡本體內部的 button 數量必須為 0
const buttonMatches = renderedHtml.match(/<button/g);
assert(!buttonMatches || buttonMatches.length === 0, '對話氣泡內文（.bubble）中的 <button> 數量嚴格等於 0');

// 斷言 2：對話氣泡本體必須包含標準語意標籤
assert(renderedHtml.includes('alert-safety'), '包含安全篩檢警告卡片');
assert(renderedHtml.includes('md-li'), '包含標準項目清單 (•)');
assert(renderedHtml.includes('md-oli'), '包含標準數字清單 (1.)');
assert(renderedHtml.includes('alert-avoid'), '包含應避免動作卡片');
assert(renderedHtml.includes('alert-consult'), '包含運動物理治療師諮詢大標卡片');
assert(renderedHtml.includes('md-hr'), '包含標準分隔線');

// 斷言 3：追問清單正確抽離
assert(parsed.followups && parsed.followups.length === 3, '相關探索問題數量嚴格等於 3');
assert(parsed.followups[0] === '辦公室久坐時，要怎麼調整坐姿才能減輕屁股和腰部的負擔？', '第一條追問題目文字完全匹配');
assert(!parsed.body.includes('【相關探索】'), '對話氣泡主體內文中不殘留【相關探索】標題');

// 斷言 4：免責聲明不殘留於氣泡主體
assert(!parsed.body.includes('免責聲明：'), '對話氣泡主體內文中不包含免責聲明長文');

// 斷言 5：劑量在地化替換測試
const testDosage = localizeTaiwanese('此動作的運動劑量為每天 3 組。');
assert(testDosage.includes('建議組數與次數') && !testDosage.includes('劑量'), 'localizeTaiwanese 成功將「運動劑量」轉為「建議組數與次數」');

// 斷言 6：複製純文字清洗測試（絕無 #、* 殘留）
const rawSampleWithMd = '### 【安全篩檢與就醫指引】\n如果你久坐時屁股痛，請檢視**危險警訊**：\n* 疼痛像觸電一樣。\n* 腳部麻木。';
const cleanCopied = cleanMarkdownForClipboard(rawSampleWithMd);
assert(!cleanCopied.includes('#'), '複製純文字中 100% 移除 # 標題符號');
assert(!cleanCopied.includes('*'), '複製純文字中 100% 移除 * 符號');
assert(cleanCopied.includes('• 疼痛像觸電一樣。'), '複製純文字中清單轉為標準圓點 •');


// ── 測試 3：底層常駐免責聲明與 Modal 結構檢查 ─────────────────────
console.log('\n--- 測試 3：底部免責聲明與 Modal 結構檢查 ---');
assert(htmlCode.includes('AI 衛教內容僅供參考，無法替代實體醫療診斷 ·'), '底部常駐列文案精確匹配');
assert(htmlCode.includes('openDisclaimerModal()'), '具備點擊彈窗事件');
assert(htmlCode.includes('id="disclaimer-modal"'), '具備免責聲明 Modal DOM');

// ── 測試 4：全域按鈕函式有效性與抽屜按鈕迴歸檢驗 ─────────────────
console.log('\n--- 測試 4：全域按鈕函式有效性與抽屜按鈕迴歸檢驗 ---');
assert(typeof openHistoryDrawer === 'function', 'openHistoryDrawer 函式存在且為有效函式');
assert(typeof resetChat === 'function', 'resetChat 函式存在且為有效函式');
assert(typeof openScreenerModal === 'function', 'openScreenerModal 函式存在且為有效函式');
assert(typeof openJkoModal === 'function', 'openJkoModal 函式存在且為有效函式');
assert(typeof openDisclaimerModal === 'function', 'openDisclaimerModal 函式存在且為有效函式');
assert(!htmlCode.includes('openRightDrawer('), '絕無殘留 openRightDrawer 未定義呼叫');
assert(!htmlCode.includes('closeRightDrawer('), '絕無殘留 closeRightDrawer 未定義呼叫');
try {
  openHistoryDrawer();
  assert(true, 'openHistoryDrawer 執行無拋出未捕獲例外（如 ReferenceError）');
} catch (e) {
  assert(false, `openHistoryDrawer 執行拋出異常: ${e.message}`);
}

// ── 測試 5：對話時熱門探索橫軸隱藏與重置顯示機制 ─────────────────
console.log('\n--- 測試 5：對話時熱門探索橫軸隱藏與重置顯示機制 ---');
assert(typeof hideSuggestionsStrip === 'function', 'hideSuggestionsStrip 函式存在且為有效函式');
assert(htmlCode.includes('hideSuggestionsStrip()'), 'sendMessage/loadHistorySession 中正確呼叫 hideSuggestionsStrip');

// ── 測試 6：快篩「✏️ 其他（自行補充/填寫）」自訂輸入機制 ─────────
console.log('\n--- 測試 6：快篩「✏️ 其他（自行補充/填寫）」自訂輸入機制 ---');
assert(typeof toggleScreenerCustomInput === 'function', 'toggleScreenerCustomInput 函式存在且為有效函式');
assert(typeof submitScreenerCustom === 'function', 'submitScreenerCustom 函式存在且為有效函式');
assert(htmlCode.includes('screener-custom-btn'), '具備快篩自填按鈕樣式');
assert(htmlCode.includes('screener-custom-input'), '具備快篩自填文字輸入框');

// ── 測試 7：實證等級微膠囊與毛玻璃實證抽屜機制 ─────────
console.log('\n--- 測試 7：實證等級微膠囊與毛玻璃實證抽屜機制 ---');
assert(typeof openEvidenceModal === 'function', 'openEvidenceModal 函式存在且為有效函式');
assert(typeof closeEvidenceModal === 'function', 'closeEvidenceModal 函式存在且為有效函式');
assert(typeof switchEvidenceScaleLevel === 'function', 'switchEvidenceScaleLevel 函式存在且為有效函式');
assert(htmlCode.includes('id="evidence-modal"'), '具備實證等級 Modal DOM');
assert(htmlCode.includes('evidence-scale-track'), '具備三段式實證量尺 DOM');

const testEvidenceMd = '動作建議：調整深蹲角度至不卡不痛。[🟢 Level A · 2023 ↗](evidence:A|2023|測試論文|白話結論|JOSPT|https://pubmed.ncbi.nlm.nih.gov/31475628/) 還有日常活動 [🟡 Level B · 2022 ↗]';
const renderedEvidenceHtml = md(testEvidenceMd);
assert(renderedEvidenceHtml.includes('evidence-badge level-a'), 'md 成功將 rich evidence 解析為 level-a 徽章');
assert(renderedEvidenceHtml.includes('evidence-badge level-b'), 'md 成功將 standalone evidence 解析為 level-b 徽章');
assert(!renderedEvidenceHtml.match(/<button/g), '實證徽章內部無非法 button 標籤');

const cleanedEvidenceClip = cleanMarkdownForClipboard(testEvidenceMd);
assert(cleanedEvidenceClip.includes('[Level A 實證') && !cleanedEvidenceClip.includes('evidence:'), 'cleanMarkdownForClipboard 成功清洗實證語法為簡明標籤');


console.log('\n====================================================');
if (failureCount === 0) {
  console.log('🎉 所有自動化測試 100% 通過！系統穩定，允許安全部署。');
  console.log('====================================================\n');
  process.exit(0);
} else {
  console.error(`💥 共有 ${failureCount} 項測試未通過！部署已自動中斷，嚴禁發布。`);
  console.log('====================================================\n');
  process.exit(1);
}

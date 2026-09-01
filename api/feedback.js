// Lightweight feedback collector & stats API
const globalFeedbackStats = {
  thumbsUp: 0,
  thumbsDown: 0,
  recentFeedback: [],
};

// 速率限制：每個 IP 每分鐘最多 10 次 feedback
const feedbackRateMap = new Map();
const FEEDBACK_LIMIT = 10;
const FEEDBACK_WINDOW = 60 * 1000; // 1 分鐘

function checkFeedbackRate(ip) {
  if (!ip || ip === 'unknown') return true;
  const now = Date.now();
  const entry = feedbackRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    feedbackRateMap.set(ip, { count: 1, resetAt: now + FEEDBACK_WINDOW });
    return true;
  }
  if (entry.count >= FEEDBACK_LIMIT) return false;
  entry.count++;
  return true;
}

const ALLOWED_ORIGIN = 'https://taiwan-pt-web.vercel.app';
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  // 僅允許同源 CORS
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    // 速率限制
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkFeedbackRate(clientIp)) {
      return res.status(429).json({ error: '請求過於頻繁，請稍後再試。' });
    }

    try {
      const { type, query, reasons, comment, feedback, msgId } = req.body || {};

      // 驗證 type 欄位
      if (!['up', 'down'].includes(type)) {
        return res.status(400).json({ error: '無效的回饋類型' });
      }

      if (type === 'up') {
        globalFeedbackStats.thumbsUp++;
      } else {
        globalFeedbackStats.thumbsDown++;
      }

      const formattedReasons = Array.isArray(reasons) ? reasons.join(', ') : (reasons || '');
      const userComment = typeof comment === 'string' ? comment.substring(0, 200) : (typeof feedback === 'string' ? feedback.substring(0, 100) : '');

      const entry = {
        type,
        query: typeof query === 'string' ? query.substring(0, 80) : '',
        reasons: formattedReasons,
        comment: userComment,
        msgId: typeof msgId === 'string' ? msgId.substring(0, 40) : '',
        time: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      };

      globalFeedbackStats.recentFeedback.unshift(entry);
      if (globalFeedbackStats.recentFeedback.length > 50) {
        globalFeedbackStats.recentFeedback.pop();
      }

      console.log(`📊 [USER_FEEDBACK] [${type.toUpperCase()}] Q: "${entry.query}" | Reasons: "${entry.reasons}" | Note: "${entry.comment}" | Time: ${entry.time}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      // 不洩漏內部錯誤
      console.error('[feedback error]', e.message);
      return res.status(500).json({ error: '服務暫時無法使用' });
    }
  }

  if (req.method === 'GET') {
    const total = globalFeedbackStats.thumbsUp + globalFeedbackStats.thumbsDown;
    return res.status(200).json({
      summary: {
        totalFeedback: total,
        thumbsUp: globalFeedbackStats.thumbsUp,
        thumbsDown: globalFeedbackStats.thumbsDown,
        satisfactionRate: total > 0
          ? `${Math.round((globalFeedbackStats.thumbsUp / total) * 100)}%`
          : '尚未收集到足夠數據',
      },
      recentFeedback: globalFeedbackStats.recentFeedback,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

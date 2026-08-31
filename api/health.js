import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: "edge",
};

const ALLOWED_ORIGIN = "https://taiwan-pt-web.vercel.app";

export default async function handler(req) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = !origin || origin === ALLOWED_ORIGIN || origin.endsWith(".vercel.app") || origin.includes("localhost");

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  if (isAllowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  const startTime = Date.now();
  const report = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    latencyMs: 0,
    services: {
      gemini_ai: { status: "unknown", latencyMs: 0 },
      ncbi_pubmed: { status: "unknown", latencyMs: 0 },
      edge_runtime: { status: "ok" },
    },
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    report.status = "degraded";
    report.services.gemini_ai = { status: "missing_api_key" };
  } else {
    const gStart = Date.now();
    const TEST_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
    let geminiOk = false;
    let lastErr = null;
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const mName of TEST_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: mName,
          generationConfig: { maxOutputTokens: 10 },
        });
        const res = await Promise.race([
          model.generateContent("ping"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3500))
        ]);
        if (res?.response?.text()) {
          geminiOk = true;
          report.services.gemini_ai = {
            status: "ok",
            activeModel: mName,
            latencyMs: Date.now() - gStart,
          };
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!geminiOk) {
      report.status = "degraded";
      report.services.gemini_ai = {
        status: "error",
        message: lastErr?.message || "All models unavailable",
        latencyMs: Date.now() - gStart,
      };
    }
  }

  const pStart = Date.now();
  try {
    const ncbiRes = await fetch(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=exercise&retmode=json&retmax=1",
      { signal: AbortSignal.timeout(2000) }
    );
    report.services.ncbi_pubmed = {
      status: ncbiRes.ok ? "ok" : ("http_" + ncbiRes.status),
      latencyMs: Date.now() - pStart,
    };
  } catch (pErr) {
    report.services.ncbi_pubmed = {
      status: "timeout_or_unreachable",
      latencyMs: Date.now() - pStart,
      note: "系統已配置 2 秒硬超時自動降級保護，不會影響使用者對話體驗。",
    };
  }

  report.latencyMs = Date.now() - startTime;
  const statusCode = report.status === "healthy" ? 200 : 207;

  return new Response(JSON.stringify(report, null, 2), {
    status: statusCode,
    headers,
  });
}

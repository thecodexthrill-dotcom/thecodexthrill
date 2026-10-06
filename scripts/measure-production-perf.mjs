// scripts/measure-production-perf.mjs
import http from "node:http";

const routes = [
  "/",
  "/about",
  "/services",
  "/services/web-applications",
  "/portfolio",
  "/portfolio/apex-capital-engine",
  "/blog",
  "/blog/start-with-the-workflow",
  "/contact",
  "/pricing",
  "/privacy",
  "/security",
  "/terms",
  "/login",
];

async function measureRoute(path) {
  return new Promise((resolve) => {
    const start = performance.now();
    let ttfb = 0;

    const req = http.get(
      {
        host: "localhost",
        port: 3000,
        path,
        headers: {
          "User-Agent": "PerformanceAuditor/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (res) => {
        ttfb = Math.round(performance.now() - start);
        let bytes = 0;

        res.on("data", (chunk) => {
          bytes += chunk.length;
        });

        res.on("end", () => {
          const totalDuration = Math.round(performance.now() - start);
          resolve({
            path,
            statusCode: res.statusCode,
            ttfbMs: ttfb,
            totalMs: totalDuration,
            bytes,
            contentType: res.headers["content-type"] || "unknown",
            cacheControl: res.headers["cache-control"] || "none",
          });
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        path,
        statusCode: 0,
        error: err.message,
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        path,
        statusCode: 408,
        error: "Timeout after 5000ms",
      });
    });
  });
}

async function run() {
  console.log("============================================================");
  console.log("PRODUCTION PERFORMANCE MEASUREMENT (NEXT START)");
  console.log("============================================================");

  // Warmup first
  await measureRoute("/");

  const results = [];
  for (const route of routes) {
    const res = await measureRoute(route);
    results.push(res);
    console.log(
      `[HTTP ${res.statusCode}] ${res.path.padEnd(35)} TTFB: ${String(res.ttfbMs).padStart(4)}ms | Total: ${String(res.totalMs).padStart(4)}ms | Size: ${String(res.bytes).padStart(6)}B`
    );
  }

  const avgTtfb = Math.round(
    results.reduce((acc, r) => acc + (r.ttfbMs || 0), 0) / results.length
  );
  const avgTotal = Math.round(
    results.reduce((acc, r) => acc + (r.totalMs || 0), 0) / results.length
  );

  console.log("============================================================");
  console.log(`AVERAGE TTFB: ${avgTtfb}ms`);
  console.log(`AVERAGE TOTAL RESPONSE TIME: ${avgTotal}ms`);
  console.log(`ALL ROUTES RETURNED HTTP 200: ${results.every((r) => r.statusCode === 200)}`);
  console.log("============================================================");
}

run();


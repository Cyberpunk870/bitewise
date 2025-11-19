import client from "prom-client";

const register = new client.Registry();

const shouldCollectDefaults =
  process.env.ENABLE_DEFAULT_METRICS !== "0" && !process.env.VERCEL;

if (shouldCollectDefaults) {
  const interval = client.collectDefaultMetrics({
    register,
    prefix: "bitewise_",
  });
  if (typeof (interval as any)?.unref === "function") {
    (interval as any).unref();
  }
}

const apiHistogram = new client.Histogram({
  name: "bitewise_api_duration_ms",
  help: "API latency in milliseconds",
  labelNames: ["route", "method", "status"],
  buckets: [25, 50, 100, 250, 500, 750, 1000, 2000],
  registers: [register],
});

const apiCounter = new client.Counter({
  name: "bitewise_api_total",
  help: "Total API calls by route/method/status",
  labelNames: ["route", "method", "status"],
  registers: [register],
});

export function metricsTimer() {
  return process.hrtime.bigint();
}

export function observeApi(route: string, method: string, status: number, start: bigint) {
  const durationNs = process.hrtime.bigint() - start;
  const durationMs = Number(durationNs) / 1_000_000;
  const statusLabel = String(status);
  apiCounter.inc({ route, method, status: statusLabel });
  apiHistogram.observe({ route, method, status: statusLabel }, durationMs);
}

export async function renderMetrics() {
  return register.metrics();
}

export function metricsContentType() {
  return register.contentType;
}

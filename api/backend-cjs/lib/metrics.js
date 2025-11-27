"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsTimer = metricsTimer;
exports.observeApi = observeApi;
exports.renderMetrics = renderMetrics;
exports.metricsContentType = metricsContentType;
const prom_client_1 = __importDefault(require("prom-client"));
const register = new prom_client_1.default.Registry();
const shouldCollectDefaults = process.env.ENABLE_DEFAULT_METRICS !== "0" && !process.env.VERCEL;
if (shouldCollectDefaults) {
    const interval = prom_client_1.default.collectDefaultMetrics({
        register,
        prefix: "bitewise_",
    });
    if (typeof interval?.unref === "function") {
        interval.unref();
    }
}
const apiHistogram = new prom_client_1.default.Histogram({
    name: "bitewise_api_duration_ms",
    help: "API latency in milliseconds",
    labelNames: ["route", "method", "status"],
    buckets: [25, 50, 100, 250, 500, 750, 1000, 2000],
    registers: [register],
});
const apiCounter = new prom_client_1.default.Counter({
    name: "bitewise_api_total",
    help: "Total API calls by route/method/status",
    labelNames: ["route", "method", "status"],
    registers: [register],
});
function metricsTimer() {
    return process.hrtime.bigint();
}
function observeApi(route, method, status, start) {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1000000;
    const statusLabel = String(status);
    apiCounter.inc({ route, method, status: statusLabel });
    apiHistogram.observe({ route, method, status: statusLabel }, durationMs);
}
async function renderMetrics() {
    return register.metrics();
}
function metricsContentType() {
    return register.contentType;
}

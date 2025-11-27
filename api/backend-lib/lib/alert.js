"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertEvent = alertEvent;
const logger_1 = __importDefault(require("./logger"));
const log = logger_1.default.child({ module: "alert" });
/**
 * Best-effort alert helper. If ALERT_WEBHOOK_URL is set, posts a small JSON payload.
 * Fails silently so it never breaks request handling.
 */
async function alertEvent(name, meta = {}) {
    try {
        const url = process.env.ALERT_WEBHOOK_URL;
        if (!url)
            return;
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                meta,
                ts: Date.now(),
                env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
            }),
        }).catch((err) => {
            log.warn({ err }, "alert webhook failed");
        });
    }
    catch (err) {
        log.warn({ err }, "alertEvent failed");
    }
}

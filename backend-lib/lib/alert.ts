import logger from "./logger";

const log = logger.child({ module: "alert" });

/**
 * Best-effort alert helper. If ALERT_WEBHOOK_URL is set, posts a small JSON payload.
 * Fails silently so it never breaks request handling.
 */
export async function alertEvent(name: string, meta: Record<string, any> = {}) {
  try {
    const url = process.env.ALERT_WEBHOOK_URL;
    if (!url) return;
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
  } catch (err) {
    log.warn({ err }, "alertEvent failed");
  }
}


// backend-lib/backend-api/actowiz.ts
// Thin proxy to Actowiz event feed for the client poller (src/lib/feed/ActowizAdapter.ts).

import express from "express";
import logger from "../lib/logger";

const log = logger.child({ module: "actowiz-proxy" });
const router = express.Router();

const ACTOWIZ_BASE = process.env.ACTOWIZ_FEED_BASE || process.env.ACTOWIZ_API;
const ACTOWIZ_TOKEN = process.env.ACTOWIZ_FEED_TOKEN || process.env.ACTOWIZ_TOKEN;

router.get("/events", async (req, res) => {
  if (!ACTOWIZ_BASE) {
    return res.status(501).json({ ok: false, error: "ACTOWIZ_FEED_BASE env missing" });
  }

  const sinceParam = typeof req.query.since === "string" ? req.query.since : "0";
  const since = Number.isFinite(Number(sinceParam)) ? Number(sinceParam) : 0;

  // Build upstream URL
  const url = new URL(`${ACTOWIZ_BASE.replace(/\/$/, "")}/events`);
  url.searchParams.set("since", String(since));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url.toString(), {
      headers: ACTOWIZ_TOKEN ? { Authorization: `Bearer ${ACTOWIZ_TOKEN}` } : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      log.warn({ status: resp.status }, "actowiz upstream failed");
      return res.status(resp.status).json({ ok: false, error: `upstream ${resp.status}` });
    }

    const data = await resp.json();
    const cursor = typeof data?.cursor === "number" ? data.cursor : since;
    const items = Array.isArray(data?.items) ? data.items : [];

    return res.json({ ok: true, cursor, items });
  } catch (err: any) {
    const code = err?.name === "AbortError" ? 504 : 500;
    log.error({ err }, "actowiz proxy error");
    return res.status(code).json({ ok: false, error: err?.message || "proxy failed" });
  }
});

export default router;

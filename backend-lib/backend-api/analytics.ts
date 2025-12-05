// backend-lib/backend-api/analytics.ts

import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import logger from "../lib/logger";

const log = logger.child({ module: "analytics" });

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const t0 = Date.now();
    const daysRaw = Number(req.query?.days);
    const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(1, daysRaw)) : 7;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const db = getFirestore();
    const snap = await db
      .collection("analytics_events")
      .where("ts", ">=", since)
      .orderBy("ts", "desc")
      .limit(10000)
      .get();

    const totals: Record<string, number> = {};
    const timelineMap: Record<string, number> = {};
    const categories: Record<string, number> = {};

    const categorize = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes("push")) return "push";
      if (n.includes("passkey") || n.includes("webauthn")) return "passkey";
      if (n.includes("referral")) return "referral";
      if (n.includes("ingest")) return "ingest";
      return "other";
    };

    snap.forEach((doc) => {
      const data = doc.data() as any;
      const name = String(data?.name || "unknown");
      totals[name] = (totals[name] || 0) + 1;
      const cat = categorize(name);
      categories[cat] = (categories[cat] || 0) + 1;

      const ts = Number(data?.ts) || Date.now();
      const dateKey = new Date(ts).toISOString().slice(0, 10);
      timelineMap[dateKey] = (timelineMap[dateKey] || 0) + 1;
    });

    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    const errorEvents = Object.entries(totals).reduce((acc, [name, count]) => {
      const n = name.toLowerCase();
      if (n.includes("error") || n.includes("fail") || n.includes("timeout")) {
        return acc + count;
      }
      return acc;
    }, 0);

    const funnels = {
      onboarding: {
        start: totals["onboarding_start"] || 0,
        completed: totals["onboarding_complete"] || 0,
      },
      permissions: {
        allow: (totals["perm_location_allow"] || 0) + (totals["perm_notifications_allow"] || 0) + (totals["perm_mic_allow"] || 0),
        deny: (totals["perm_location_deny"] || 0) + (totals["perm_notifications_deny"] || 0) + (totals["perm_mic_deny"] || 0),
      },
      searchToCart: {
        searches: totals["search"] || 0,
        cartAdds: totals["cart_add"] || 0,
      },
      push: {
        registered: totals["push_registered"] || 0,
        failed: totals["push_registration_failed"] || 0,
      },
      feedback: {
        submissions: totals["feedback_submit"] || 0,
      },
      errors: errorEvents,
    };

    res.json({
      ok: true,
      range: { days, since, until: Date.now() },
      totals,
      categories,
      timeline,
      sample: snap.size,
      funnels,
    });

    const elapsed = Date.now() - t0;
    if (elapsed > 2000) {
      log.warn({ elapsed, days, sample: snap.size }, "analytics summary slow");
    }
  } catch (err) {
    log.error({ err }, "GET /analytics/summary failed");
    res.status(500).json({ ok: false, error: "internal error" });
  }
});

router.get("/export", async (req, res) => {
  try {
    const daysRaw = Number(req.query?.days);
    const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(1, daysRaw)) : 7;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const db = getFirestore();
    const snap = await db
      .collection("analytics_events")
      .where("ts", ">=", since)
      .orderBy("ts", "desc")
      .limit(20000)
      .get();

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=\"analytics-${days}d.csv\"`);
    res.write("ts_iso,name,uid,meta\n");
    snap.forEach((doc) => {
      const d = doc.data() as any;
      const tsIso = new Date(Number(d?.ts) || Date.now()).toISOString();
      const name = String(d?.name || "unknown").replace(/,/g, " ");
      const uid = String(d?.uid || "").replace(/,/g, " ");
      const meta = (() => {
        try {
          const m = { ...(d?.meta || {}) };
          return JSON.stringify(m).replace(/"/g, '""');
        } catch {
          return "";
        }
      })();
      res.write(`${tsIso},${name},${uid},"${meta}"\n`);
    });
    res.end();
  } catch (err) {
    log.error({ err }, "GET /analytics/export failed");
    res.status(500).json({ ok: false, error: "internal error" });
  }
});

export default router;

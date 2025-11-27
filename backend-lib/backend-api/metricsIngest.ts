// Lightweight metrics ingest (unauthenticated, but minimal fields) to capture client beacons.
import express, { Request, Response } from "express";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import logger from "../lib/logger";

const log = logger.child({ module: "metrics-ingest" });
const router = express.Router();

type MetricPayload = {
  event: string;
  screen?: string;
  ms?: number;
  message?: string;
};

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as MetricPayload | MetricPayload[];
    const items = Array.isArray(body) ? body : [body];
    const db = getFirestore();
    const batch = db.batch();
    items.forEach((it) => {
      if (!it?.event) return;
      const doc = db.collection("client_metrics").doc();
      batch.set(doc, {
        id: doc.id,
        event: String(it.event),
        screen: it.screen || null,
        ms: typeof it.ms === "number" ? it.ms : null,
        message: it.message || null,
        ts: Date.now(),
        created_at: new Date().toISOString(),
        // optional: user-agent/IP for debugging
        ua: req.headers["user-agent"] || null,
      });
    });
    await batch.commit();
    res.json({ ok: true, count: items.length });
  } catch (err: any) {
    log.error({ err }, "metrics ingest failed");
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

export default router;

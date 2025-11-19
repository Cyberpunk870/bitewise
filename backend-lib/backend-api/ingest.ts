import express, { Request, Response, NextFunction, RequestHandler } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import logger from "../lib/logger";

const log = logger.child({ module: "ingest" });

const router = express.Router();

const EventSchema = z.object({
  name: z.string().min(1).max(64),
  ts: z.number().int().optional(),
  props: z.record(z.string(), z.any()).optional(),
});

const ingestHandler: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.uid || (req as any).uid || null;
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (!events.length) return res.status(400).json({ ok: false, error: "events required" });
    if (events.length > 50) return res.status(400).json({ ok: false, error: "too many events" });

    const parsed = events.map((ev: unknown) => EventSchema.parse(ev));
    const db = getFirestore();
    const batch = db.batch();
    parsed.forEach((ev: z.infer<typeof EventSchema>) => {
      const doc = db.collection("analytics_events").doc();
      batch.set(doc, {
        id: doc.id,
        uid,
        name: ev.name,
        props: ev.props || {},
        ts: ev.ts || Date.now(),
        user_agent: req.headers["user-agent"] || null,
        created_at: new Date().toISOString(),
      });
    });
    await batch.commit();
    res.json({ ok: true, count: parsed.length });
  } catch (err: any) {
    log.error({ err }, "POST /ingest failed");
    const status = err?.name === "ZodError" ? 400 : 500;
    if (status === 500) return next(err);
    res.status(status).json({ ok: false, error: err?.message || "internal error" });
  }
};

router.post("/", ingestHandler);

export default router;

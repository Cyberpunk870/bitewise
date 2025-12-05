import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import logger from "../lib/logger";

const log = logger.child({ module: "feedback" });
const router = Router();

function clean(input: unknown): string | null {
  if (!input) return null;
  const str = String(input).trim();
  return str ? str : null;
}

router.post("/", async (req: any, res) => {
  const uid = req.user?.uid || req.uid;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const message = clean(req.body?.message);
    if (!message) return res.status(400).json({ ok: false, error: "message required" });

    const db = getFirestore();
    let phone: string | null = null;
    let name: string | null = null;
    try {
      const snap = await db.collection("users").doc(uid).get();
      const data = snap.data() || {};
      phone = clean(data.phone);
      name = clean(data.name);
    } catch (err) {
      log.warn({ err, uid }, "could not fetch user profile for feedback");
    }

    const now = new Date().toISOString();
    const doc = await db.collection("feedback").add({
      uid,
      phone,
      name,
      message,
      steps: clean(req.body?.steps),
      category: clean(req.body?.category) || "general",
      screen: clean(req.body?.screen),
      severity: clean(req.body?.severity) || "medium",
      device_info: clean(req.body?.deviceInfo),
      created_at: now,
      status: "open",
    });

    return res.json({ ok: true, id: doc.id });
  } catch (err: any) {
    log.error({ err, uid }, "feedback submission failed");
    return res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

export default router;

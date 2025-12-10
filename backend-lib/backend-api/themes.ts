// backend-lib/backend-api/themes.ts
import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { ensureAdmin } from "../lib/firebaseAdmin";

type Promo = {
  title?: string;
  body?: string;
  ctaLabel?: string;
  href?: string;
};

type Theme = {
  id?: string;
  name: string;
  start: string; // ISO date
  end: string; // ISO date
  priority?: number;
  enabled?: boolean;
  accent: string;
  gradient: string;
  heroTitle: string;
  heroSubtitle: string;
  promo?: Promo;
};

const COLLECTION = "seasonal_themes";
const router = Router();
export const adminThemesRouter = Router();

function isActive(theme: Theme, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const enabled = theme.enabled !== false;
  return enabled && theme.start <= today && today <= theme.end;
}

// --- Public: list active themes ---
router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const snap = await db.collection(COLLECTION).where("enabled", "==", true).get();
    const now = new Date();
    const themes: Theme[] = [];
    snap.forEach((doc) => themes.push({ id: doc.id, ...(doc.data() as any) }));
    const active = themes.filter((t) => isActive(t, now));
    active.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    res.json({ ok: true, themes: active });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

// --- Public: track impression/click ---
router.post("/track", async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || "").slice(0, 80);
    const event = String(req.body?.event || "impression");
    if (!name) return res.status(400).json({ ok: false, error: "name required" });
    const db = getFirestore();
    const uid = (req as any).user?.uid || null;
    await db.collection("analytics_events").add({
      name: `theme_${event}`,
      ts: Date.now(),
      uid,
      meta: { theme: name },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "internal error" });
  }
});

// --- Admin: list all themes ---
adminThemesRouter.get("/list", async (_req: Request, res: Response) => {
  try {
    ensureAdmin();
    const db = getFirestore();
    const snap = await db.collection(COLLECTION).get();
    const themes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    res.json({ ok: true, themes });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

// --- Admin: upsert a theme ---
adminThemesRouter.post("/upsert", async (req: Request, res: Response) => {
  try {
    ensureAdmin();
    const theme = req.body as Theme;
    if (!theme?.name || !theme?.start || !theme?.end || !theme?.gradient || !theme?.accent || !theme?.heroTitle || !theme?.heroSubtitle) {
      return res.status(400).json({ ok: false, error: "missing required fields" });
    }
    const db = getFirestore();
    const id = theme.id || theme.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    await db.collection(COLLECTION).doc(id).set(
      {
        ...theme,
        enabled: theme.enabled !== false,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

// --- Admin: delete ---
adminThemesRouter.post("/delete", async (req: Request, res: Response) => {
  try {
    ensureAdmin();
    const id = String(req.body?.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "id required" });
    const db = getFirestore();
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

export default router;

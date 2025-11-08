// backend-lib/app.ts
// Express app (no .listen here). Used by both local dev and Vercel serverless.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); // Note: Vercel ignores local files; envs must be set in dashboard

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";

// --- Firebase Admin (lazy init) ---
import {
  initializeApp as initAdmin,
  cert,
  type ServiceAccount,
  getApps,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";

console.log("[server/app] module loading…");

/* -------------------- Helpers: load credentials & lazy init -------------------- */
function loadServiceAccount(): ServiceAccount {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path && fs.existsSync(path)) {
    console.log("[server/app] using FIREBASE_SERVICE_ACCOUNT_PATH:", path);
    try {
      const raw = fs.readFileSync(path, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.private_key === "string" && parsed.private_key.includes("\\n")) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      return parsed;
    } catch (e) {
      console.error("[server/app] failed to read/parse SA file:", e);
      throw e;
    }
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    console.log("[server/app] using FIREBASE_SERVICE_ACCOUNT_JSON (len=%d)", json.length);
    try {
      const sa: any = JSON.parse(json);
      if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
        sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      }
      if (!sa.client_email || !sa.private_key) {
        console.error("[server/app] SA JSON missing keys (client_email/private_key)");
      }
      return sa as ServiceAccount;
    } catch (e) {
      console.error("[server/app] SA JSON parse failed:", e);
      throw e;
    }
  }

  console.error(
    "[server/app] no FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON present"
  );
  throw new Error(
    "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON."
  );
}

// Initialise Admin exactly once
function ensureAdmin() {
  const before = getApps().length;
  console.log("[server/app] ensureAdmin() called; apps before =", before);
  if (!before) {
    const sa = loadServiceAccount();
    initAdmin({ credential: cert(sa) });
    console.log("[server/app] firebase-admin initialised; apps after =", getApps().length);
  }
}

// Express middleware that guarantees Admin is ready
function ensureAdminMiddleware(_req: Request, _res: Response, next: NextFunction) {
  try {
    console.log("[server/app] ensureAdminMiddleware enter");
    ensureAdmin();
  } catch (e) {
    console.error("[server/app] ensureAdminMiddleware error:", e);
  }
  next();
}

/* -------------------------------- App & middleware ------------------------------- */
const app = express(); // ✅ Changed from "export const app" to plain const
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("tiny")); // request logging

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Welcome to BiteWise API" });
});

/* --------------------------- Health & Readiness --------------------------- */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    status: "server running",
    admin_ready: getApps().length > 0,
  });
});

app.get("/api/ready", (_req, res) => {
  try {
    ensureAdmin();
    const ready = getApps().length > 0;
    res.status(ready ? 200 : 503).json({
      ok: ready,
      admin_ready: ready,
      data_backend: process.env.DATA_BACKEND ?? "firestore",
      write_strategy: process.env.WRITE_STRATEGY ?? "primary-only",
      has_sa_path: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
      has_sa_json: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    });
  } catch (e: any) {
    res
      .status(503)
      .json({ ok: false, admin_ready: false, error: String(e?.message || e) });
  }
});

/* ----------------- Auth: mintCustomToken for passkey unlock ----------------- */
app.post("/api/auth/mintCustomToken", async (req, res) => {
  try {
    console.log("[server/app] /api/auth/mintCustomToken hit");
    const allow = process.env.ALLOW_DEV_PASSKEY_REAUTH;
    if (!allow) {
      console.warn("[server/app] passkey reauth disabled");
      return res.status(403).json({ ok: false, error: "passkey reauth disabled" });
    }
    ensureAdmin();
    const phone = String(req.body?.phone || "").trim();
    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone required" });
    }
    const db = getFirestore();
    const snap = await db.collection("users").where("phone", "==", phone).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ ok: false, error: "no such user" });
    }
    const doc = snap.docs[0];
    const uid = doc.id;
    const token = await getAdminAuth().createCustomToken(uid, { phone });
    return res.json({ ok: true, token });
  } catch (err: any) {
    console.error("mintCustomToken error", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

/* ---------------- From here: require Admin + Firebase Auth ---------------- */
import { verifyAuth } from "./middleware/verifyAuth";
app.use("/api", ensureAdminMiddleware);
app.use("/api", verifyAuth);

/* --------------------------------- Route impls --------------------------------- */
import { ingestEvents } from "./backend-api/ingest";
import { getTasks } from "./backend-api/tasks";
import { getAchievements } from "./backend-api/achievements";
import { getLeaderboard } from "./backend-api/leaderboard";
import { getAddresses, saveAddress, nearestFor } from "./backend-api/user/addresses";
import { getOrderEvents, markOutbound, markCompletion } from "./backend-api/orders";
import { getUserProfile, upsertBasicProfile } from "./backend-api/user/profile";
import { addCoins } from "./backend-api/user/coins";

/* -------------------------- Push Registration -------------------------- */
app.post("/api/push/register", async (req, res) => {
  try {
    console.log("[server/app] /api/push/register");
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "web");
    if (!token) return res.status(400).json({ ok: false, error: "token required" });
    const db = getFirestore();
    const docRef = db.collection("users").doc(uid).collection("devices").doc(token);
    await docRef.set(
      {
        token,
        platform,
        updated_at: new Date().toISOString(),
        active: true,
      },
      { merge: true }
    );
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("push/register error", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

app.post("/api/push/test", async (req, res) => {
  try {
    console.log("[server/app] /api/push/test");
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const db = getFirestore();
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("devices")
      .orderBy("updated_at", "desc")
      .limit(1)
      .get();
    if (snap.empty) return res.status(404).json({ ok: false, error: "no device" });
    const token = snap.docs[0].data().token as string;
    const resp = await getMessaging().send({
      token,
      notification: { title: "🍔 BiteWise", body: "Push is working!" },
      data: { kind: "test" },
    });
    return res.json({ ok: true, resp });
  } catch (err: any) {
    const info = err?.errorInfo || err?.code || err?.message || String(err);
    console.error("[push/test] send error", info, err?.stack || "");
    return res.status(500).json({ ok: false, error: info });
  }
});

/* -------------------------- Other routes -------------------------- */
app.post("/api/ingest", async (req, res) => {
  const out = await ingestEvents(req.body);
  res.json(out);
});

app.get("/api/tasks", async (_req, res) => {
  res.json(await getTasks());
});

app.get("/api/achievements", async (req, res) => {
  const uid = (req as any).uid || null;
  res.json(await getAchievements(uid));
});

app.get("/api/leaderboard", async (_req, res) => {
  res.json(await getLeaderboard());
});

app.get("/api/user/addresses", async (req, res) => {
  const uid = (req as any).uid;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  res.json(await getAddresses(uid));
});

app.post("/api/user/addresses", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const body = {
      id: req.body?.id as string | undefined,
      label: String(req.body?.label ?? ""),
      addressLine: (req.body?.addressLine ?? "") as string,
      lat: Number(req.body?.lat),
      lng: Number(req.body?.lng),
      active:
        typeof req.body?.active === "boolean"
          ? req.body.active
          : typeof req.body?.is_active === "boolean"
          ? req.body.is_active
          : false,
    };
    if (!body.label || !Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
      return res.status(400).json({ ok: false, error: "label,lat,lng required" });
    }
    const out = await saveAddress(uid, body);
    res.json(out);
  } catch (err: any) {
    res.status(400).json({ ok: false, error: String(err?.message ?? err) });
  }
});

app.get("/api/user/nearest", async (req, res) => {
  const uid = (req as any).uid;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ ok: false, error: "lat/lng required" });
  }
  const out = await nearestFor(uid, lat, lng);
  res.json({ ok: true, ...out });
});

app.get("/api/users/profile", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const out = await getUserProfile(uid);
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/users/profile", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const { name, phone } = req.body || {};
    const out = await upsertBasicProfile(uid, { name, phone });
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/users/coins/add", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    req.body = { ...(req.body || {}), uid };
    const out = await addCoins(req.body || {});
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/orders/outbound", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const out = await markOutbound({ ...req.body, user_id: uid });
    res.json(out);
  } catch (err: any) {
    res.status(400).json({ ok: false, error: String(err?.message ?? err) });
  }
});

app.post("/api/orders/complete", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const id = req.body?.id as string;
    const saved = Number(req.body?.saved_amount ?? 0);
    if (!id || !Number.isFinite(saved) || saved < 0) {
      return res
        .status(400)
        .json({ ok: false, error: "id and saved_amount required" });
    }
    const out = await markCompletion(uid, id, saved);
    res.json(out);
  } catch (err: any) {
    res.status(400).json({ ok: false, error: String(err?.message ?? err) });
  }
});

app.get("/api/orders", async (req, res) => {
  const uid = (req as any).uid;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  res.json(await getOrderEvents(uid));
});

console.log("[server/app] module loaded.");

/* ✅ FINAL EXPORT — FIXED */
export default app;

// server/app.ts
// Express app (no .listen here). Used by both local dev and Vercel serverless.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); // load env first

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

/* -------------------- Helpers: load credentials & lazy init -------------------- */

function loadServiceAccount(): ServiceAccount {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path && fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    // Parse one-line JSON from env and unescape the PEM newlines if present
    const sa: any = JSON.parse(json);
    if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
      sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    }
    return sa as ServiceAccount;
  }
  throw new Error(
    "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON."
  );
}

// Initialise Admin exactly once
function ensureAdmin() {
  if (!getApps().length) {
    const sa = loadServiceAccount();
    initAdmin({ credential: cert(sa) });
  }
}

// Express middleware that guarantees Admin is ready for routes that need it
function ensureAdminMiddleware(_req: Request, _res: Response, next: NextFunction) {
  try {
    ensureAdmin();
  } catch (e) {
    console.error("ensureAdminMiddleware error:", e);
  }
  next();
}

/* -------------------------------- App & middleware ------------------------------- */

export const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(morgan("tiny")); // request logging

/* --------------------------- Health & Debug (no auth) --------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "server running" });
});

app.get("/api/debug/ready", (_req, res) => {
  res.json({
    ok: true,
    admin_ready: getApps().length > 0,
    data_backend: process.env.DATA_BACKEND ?? "firestore",
    write_strategy: process.env.WRITE_STRATEGY ?? "primary-only",
    has_sa_path: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
    has_sa_json: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  });
});

/* ----------------- Auth: mintCustomToken for passkey unlock ----------------- */
// NOTE: This is intentionally BEFORE verifyAuth, but it needs Admin, so we call ensureAdmin().
app.post("/api/auth/mintCustomToken", async (req, res) => {
  try {
    const allow = process.env.ALLOW_DEV_PASSKEY_REAUTH;
    if (!allow) {
      return res.status(403).json({ ok: false, error: "passkey reauth disabled" });
    }

    ensureAdmin();

    const phone = String(req.body?.phone || "").trim();
    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone required" });
    }

    const db = getFirestore();
    const snap = await db
      .collection("users")
      .where("phone", "==", phone)
      .limit(1)
      .get();

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

// make sure Admin is initialised before protected routes
app.use("/api", ensureAdminMiddleware);
app.use("/api", verifyAuth);

/* --------------------------------- Route impls --------------------------------- */

// Import route helpers (pure functions). They run after middleware above.
import { ingestEvents } from "./api/ingest";
import { getTasks } from "./api/tasks";
import { getAchievements } from "./api/achievements";
import { getLeaderboard } from "./api/leaderboard";
import { getAddresses, saveAddress, nearestFor } from "./api/user/addresses";
import { getOrderEvents, markOutbound, markCompletion } from "./api/orders";
import { getUserProfile, upsertBasicProfile } from "./api/user/profile";
import { addCoins } from "./api/user/coins";

// Push
app.post("/api/push/register", async (req, res) => {
  try {
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

// Ingest
app.post("/api/ingest", async (req, res) => {
  const out = await ingestEvents(req.body);
  res.json(out);
});

// Reads
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

// Addresses
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

// Users (Profile + Coins)
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

// Orders
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
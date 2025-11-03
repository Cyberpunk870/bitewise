// bitewise/server/index.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); // load env first

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";

// --- Firebase Admin init (must be BEFORE any Firestore usage) ---
import {
  initializeApp,
  cert,
  type ServiceAccount,
  getApps,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";

function loadServiceAccount(): ServiceAccount {
  // Prefer path to avoid JSON escaping mistakes
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path && fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH (recommended) or FIREBASE_SERVICE_ACCOUNT_JSON in server/.env.local"
    );
  }
  return JSON.parse(json); // must be valid one-line JSON
}
if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}

// ----------------------------------------------------------------
// Import route helpers AFTER Admin init so Firestore is ready
import { ingestEvents } from "./api/ingest";
import { getTasks } from "./api/tasks";
import { getAchievements } from "./api/achievements";
import { getLeaderboard } from "./api/leaderboard";
import {
  getAddresses,
  saveAddress,
  nearestFor,
} from "./api/user/addresses";
// Orders API
import {
  getOrderEvents,
  markOutbound,
  markCompletion,
} from "./api/orders";
// Users profile + coins
import {
  getUserProfile,
  upsertBasicProfile,
} from "./api/user/profile";
import { addCoins } from "./api/user/coins";
// auth middleware
import { verifyAuth } from "./middleware/verifyAuth";

const app = express();
const PORT = process.env.PORT || 3000;

// basic hardening / observability
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("tiny")); // request logging

// ------------------ Health & Debug ------------------
// health
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, status: "server running" })
);
// optional: debug info (non-sensitive)
app.get("/api/debug/ready", (_req, res) => {
  res.json({
    ok: true,
    data_backend: process.env.DATA_BACKEND ?? "firestore",
    write_strategy: process.env.WRITE_STRATEGY ?? "primary-only",
    has_sa_path: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
    has_sa_json: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  });
});

// ------------------ Auth: mintCustomToken for passkey unlock ------------------
// NOTE: this route is intentionally BEFORE `app.use("/api", verifyAuth)`.
// After idle lock, the client is signed out of Firebase, so it cannot call
// protected /api routes yet. This endpoint lets the client re-establish
// Firebase auth *after* passkey verification.
app.post("/api/auth/mintCustomToken", async (req, res) => {
  try {
    // safety gate: only allow if explicitly enabled
    const allow = process.env.ALLOW_DEV_PASSKEY_REAUTH;
    if (!allow) {
      return res
        .status(403)
        .json({ ok: false, error: "passkey reauth disabled" });
    }

    const phone = String(req.body?.phone || "").trim();
    if (!phone) {
      return res
        .status(400)
        .json({ ok: false, error: "phone required" });
    }

    const db = getFirestore();
    // Find Firestore user doc with this phone
    const snap = await db
      .collection("users")
      .where("phone", "==", phone)
      .limit(1)
      .get();
    if (snap.empty) {
      return res
        .status(404)
        .json({ ok: false, error: "no such user" });
    }

    // Use that doc's id as uid
    const doc = snap.docs[0];
    const uid = doc.id;

    // Mint a Firebase Custom Token for this uid
    const adminAuth = getAdminAuth();
    const token = await adminAuth.createCustomToken(uid, {
      phone,
    });

    return res.json({ ok: true, token });
  } catch (err: any) {
    console.error("mintCustomToken error", err);
    return res
      .status(500)
      .json({ ok: false, error: "internal error" });
  }
});

// ---- apply auth for everything under /api after health/debug ----
app.use("/api", verifyAuth);

// ------------------ Push: register & test (requires auth) ------------------
app.post("/api/push/register", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "web");
    if (!token) return res.status(400).json({ ok: false, error: "token required" });

    const db = getFirestore();
    // Store under users/{uid}/devices/{token}
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
      .collection("users").doc(uid).collection("devices")
      .orderBy("updated_at", "desc").limit(1).get();

    if (snap.empty) return res.status(404).json({ ok: false, error: "no device" });

    const token = snap.docs[0].data().token as string;
    await getMessaging().send({
      token,
      notification: {
        title: "🍔 BiteWise",
        body: "Push is working!",
      },
      data: { kind: "test" },
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("push/test error", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

// ------------------ Ingest ------------------
app.post("/api/ingest", async (req, res) => {
  // lightweight client analytics / events
  const out = await ingestEvents(req.body);
  res.json(out);
});

// ------------------ Read routes ------------------
app.get("/api/tasks", async (_req, res) => {
  res.json(await getTasks());
});
app.get("/api/achievements", async (req, res) => {
  const uid = (req as any).uid || null;
  res.json(await getAchievements(uid));
});
app.get("/api/leaderboard", async (_req, res) => {
  // NOTE: Currently returns global current-week leaderboard
  res.json(await getLeaderboard());
});

// ------------------ User addresses ------------------
app.get("/api/user/addresses", async (req, res) => {
  const uid = (req as any).uid;
  if (!uid) {
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized" });
  }
  res.json(await getAddresses(uid));
});
app.post("/api/user/addresses", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res
        .status(401)
        .json({ ok: false, error: "unauthorized" });
    }
    const body = {
      id: req.body?.id,
      label: String(req.body?.label ?? ""),
      addressLine: req.body?.addressLine ?? "",
      lat: Number(req.body?.lat),
      lng: Number(req.body?.lng),
      active:
        typeof req.body?.active === "boolean"
          ? req.body.active
          : typeof req.body?.is_active === "boolean"
          ? req.body.is_active
          : false,
    };
    if (
      !body.label ||
      !Number.isFinite(body.lat) ||
      !Number.isFinite(body.lng)
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "label,lat,lng required" });
    }
    const out = await saveAddress(uid, body);
    res.json(out);
  } catch (err: any) {
    res
      .status(400)
      .json({ ok: false, error: String(err?.message ?? err) });
  }
});

// nearest helper (for silent 100 m / 300 m preference prompts)
app.get("/api/user/nearest", async (req, res) => {
  const uid = (req as any).uid;
  if (!uid) {
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized" });
  }
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res
      .status(400)
      .json({ ok: false, error: "lat/lng required" });
  }
  const out = await nearestFor(uid, lat, lng);
  res.json({ ok: true, ...out });
});

// ------------------ Users (Profile + Coins) ------------------
app.get("/api/users/profile", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res
        .status(401)
        .json({ ok: false, error: "unauthorized" });
    }
    const out = await getUserProfile(uid);
    res.json(out);
  } catch (e: any) {
    res
      .status(400)
      .json({ ok: false, error: String(e.message || e) });
  }
});

// upsert name/phone
app.post("/api/users/profile", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res
        .status(401)
        .json({ ok: false, error: "unauthorized" });
    }
    const { name, phone } = req.body || {};
    const out = await upsertBasicProfile(uid, { name, phone });
    res.json(out);
  } catch (e: any) {
    res
      .status(400)
      .json({ ok: false, error: String(e.message || e) });
  }
});

// add coins (tokens)
app.post("/api/users/coins/add", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res
        .status(401)
        .json({ ok: false, error: "unauthorized" });
    }
    // Inject uid server-side so clients can't mint coins for someone else
    req.body = { ...(req.body || {}), uid };
    const out = await addCoins(req.body || {});
    res.json(out);
  } catch (e: any) {
    res
      .status(400)
      .json({ ok: false, error: String(e.message || e) });
  }
});

// ------------------ Orders (Outbound → Completion) ------------------
// NOTE: these map to BiteWise’s redirect model (no on-platform checkout)
app.post("/api/orders/outbound", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res
        .status(401)
        .json({ ok: false, error: "unauthorized" });
    }
    const out = await markOutbound({
      ...req.body,
      user_id: uid,
    });
    res.json(out);
  } catch (err: any) {
    res
      .status(400)
      .json({ ok: false, error: String(err?.message ?? err) });
  }
});

app.post("/api/orders/complete", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res
        .status(401)
        .json({ ok: false, error: "unauthorized" });
    }
    const id = req.body?.id as string;
    const saved = Number(req.body?.saved_amount ?? 0);
    // validate inputs and block abuse
    if (!id || !Number.isFinite(saved) || saved < 0) {
      return res.status(400).json({
        ok: false,
        error: "id and saved_amount required",
      });
    }
    const out = await markCompletion(uid, id, saved);
    res.json(out);
  } catch (err: any) {
    res
      .status(400)
      .json({ ok: false, error: String(err?.message ?? err) });
  }
});

app.get("/api/orders", async (req, res) => {
  const uid = (req as any).uid;
  if (!uid) {
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized" });
  }
  res.json(await getOrderEvents(uid));
});

// ------------------ Boot ------------------
app.listen(PORT, () => {
  console.log(
    `✅ BiteWise backend running at http://localhost:${PORT}`
  );
});

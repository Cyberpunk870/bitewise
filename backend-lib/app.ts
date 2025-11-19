// backend-lib/app.ts
// Express app (no .listen here). Used by both local dev and Vercel serverless.

/// <reference path="../types/express/index.d.ts" />
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); // Vercel ignores .env.local; envs must be set in dashboard

import express, { Request, Response, NextFunction, Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";

// --- Firebase Admin (lazy init) ---
import { getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";


import userRoutes from "./backend-api/user";
import orders from "./backend-api/orders";
import leaderboard from "./backend-api/leaderboard";
import achievements from "./backend-api/achievements";
import tasks from "./backend-api/tasks";
import ingest from "./backend-api/ingest";
import analytics from "./backend-api/analytics";
import missions from "./backend-api/missions";
import { verifyAuth } from "./middleware/verifyAuth";
import logger from "./lib/logger";
import { ensureAdmin } from "./lib/firebaseAdmin";
import webauthnRouter from "./backend-api/webauthn";

const log = logger.child({ module: "app" });

log.info("module loading…");

/* -------------------- Middleware -------------------- */
function ensureAdminMiddleware(_req: Request, _res: Response, next: NextFunction) {
  try {
    ensureAdmin();
  } catch (e) {
    log.error({ err: e }, "ensureAdminMiddleware error");
  }
  next();
}

/* -------------------- App setup -------------------- */
const app = express();
const defaultOrigins = [
  "http://localhost:5173",
  "https://bitewise-five.vercel.app",
  "https://bitewise.vercel.app",
];
const envOrigins =
  process.env.CLIENT_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const allowedOrigins = Array.from(
  new Set([...defaultOrigins, ...envOrigins, ...(vercelOrigin ? [vercelOrigin] : [])])
);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(morgan("tiny"));

/* -------------------- Health -------------------- */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, status: "server running", admin_ready: getApps().length > 0 })
);

app.get("/api/ready", (_req, res) => {
  try {
    ensureAdmin();
    const ready = getApps().length > 0;
    res.status(ready ? 200 : 503).json({
      ok: ready,
      admin_ready: ready,
      has_sa_json: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: String(e?.message || e) });
  }
});

/* -------------------- Auth Mint Token -------------------- */
app.post("/api/auth/mintCustomToken", async (req, res) => {
  try {
    log.debug("/api/auth/mintCustomToken hit");
    const allow = process.env.ALLOW_CUSTOM_TOKEN_MINT === "1";
    const sharedSecret = process.env.CUSTOM_TOKEN_MINT_SECRET || "";
    const providedSecret =
      (req.headers["x-bitewise-mint-secret"] as string | undefined) ||
      (typeof req.body?.secret === "string" ? req.body.secret : "");

    if (!allow || !sharedSecret || providedSecret !== sharedSecret) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    ensureAdmin();
    const phone = String(req.body?.phone || "").trim();
    const uidFromBody = String(req.body?.uid || "").trim();
    if (!phone && !uidFromBody) {
      return res.status(400).json({ ok: false, error: "phone or uid required" });
    }

    const db = getFirestore();
    const adminAuth = getAdminAuth();
    let targetUid = uidFromBody;

    if (!targetUid && phone) {
      try {
        const authUser = await adminAuth.getUserByPhoneNumber(phone);
        targetUid = authUser.uid;
      } catch {
        const snap = await db.collection("users").where("phone", "==", phone).limit(1).get();
        if (!snap.empty) {
          targetUid = snap.docs[0].id;
        }
      }
    }

    if (!targetUid) {
      return res.status(404).json({ ok: false, error: "no such user" });
    }

    if (phone) {
      await db
        .collection("users")
        .doc(targetUid)
        .set({ phone, updated_at: new Date().toISOString() }, { merge: true });
    }

    const token = await adminAuth.createCustomToken(targetUid, phone ? { phone } : undefined);
    return res.json({ ok: true, token });
  } catch (err: any) {
    log.error({ err }, "mintCustomToken error");
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

app.use("/api/auth/webauthn", webauthnRouter);

app.get("/api/public/check-phone", async (req, res) => {
  try {
    ensureAdmin();
    const raw = typeof req.query?.phone === "string" ? req.query.phone : "";
    const phone = raw.replace(/\s+/g, "");
    const rawMode = typeof req.query?.mode === "string" ? req.query.mode : "";
    const mode = rawMode === "signup" || rawMode === "login" ? rawMode : null;
    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone required" });
    }
    const snap = await getFirestore()
      .collection("users")
      .where("phone", "==", phone)
      .limit(1)
      .get();
    const exists = !snap.empty;

    if (mode === "signup" && exists) {
      return res.status(409).json({
        ok: false,
        code: "PHONE_EXISTS",
        error: "An account with this phone already exists.",
        exists: true,
      });
    }
    if (mode === "login" && !exists) {
      return res.status(404).json({
        ok: false,
        code: "PHONE_NOT_FOUND",
        error: "No account found for this phone number.",
        exists: false,
      });
    }

    return res.json({ ok: true, exists });
  } catch (err: any) {
    log.error({ err }, "[public/check-phone] error");
    return res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

/* -------------------- Secure middlewares -------------------- */
const secureChain: Array<(req: Request, res: Response, next: NextFunction) => void> = [
  ensureAdminMiddleware,
  verifyAuth,
];

/* -------------------- Secure routes -------------------- */
app.use("/api/user", ...secureChain, userRoutes);
app.use("/api/orders", ...secureChain, orders);
app.use("/api/leaderboard", ...secureChain, leaderboard);
app.use("/api/achievements", ...secureChain, achievements);
app.use("/api/missions", ...secureChain, missions);
app.use("/api/tasks", ...secureChain, tasks);
app.use("/api/ingest", ...secureChain, ingest);
app.use("/api/analytics", ...secureChain, analytics);

/* -------------------- Push Registration -------------------- */
app.post("/api/push/register", ...secureChain, async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "token required" });

    const db = getFirestore();
    await db
      .collection("users")
      .doc(uid)
      .collection("devices")
      .doc(token)
      .set({ token, updated_at: new Date().toISOString(), active: true }, { merge: true });

    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "push/register error");
    res.status(500).json({ ok: false, error: "internal error" });
  }
});

secureApi.post("/push/sendTest", async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const db = getFirestore();
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("devices")
      .where("active", "==", true)
      .get();

    const tokens = snap.docs.map((d) => String(d.data()?.token || "").trim()).filter(Boolean);
    if (!tokens.length) {
      return res.status(404).json({ ok: false, error: "no active push tokens" });
    }

    const title = String(req.body?.title || "BiteWise");
    const body = String(req.body?.body || "Push notifications are live!");
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });

    res.json({ ok: true, sent: tokens.length });
  } catch (err: any) {
    log.error({ err }, "push/sendTest error");
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

log.info("module loaded.");
export default app;

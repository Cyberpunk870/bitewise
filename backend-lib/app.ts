// backend-lib/app.ts
// Express app (no .listen here). Used by both local dev and Vercel serverless.

/// <reference path="../types/express/index.d.ts" />
import type * as Dotenv from "dotenv";
// Load .env.local if dotenv is available; swallow missing module in serverless bundle.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv") as typeof Dotenv;
  dotenv.config({ path: ".env.local" }); // Vercel ignores .env.local; envs must be set in dashboard
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn("[app] dotenv not loaded (likely not bundled in serverless)", err && (err as any).message);
}

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
import actowiz from "./backend-api/actowiz";
import metricsIngest from "./backend-api/metricsIngest";
import referral from "./backend-api/referral";
import analytics from "./backend-api/analytics";
import missions from "./backend-api/missions";
import themesRouter, { adminThemesRouter } from "./backend-api/themes";
import feedbackRouter from "./backend-api/feedback";
import { verifyAuth, requireAdminAccess } from "./middleware/verifyAuth";
import logger from "./lib/logger";
import { metricsContentType, renderMetrics, metricsTimer, observeApi } from "./lib/metrics";
import { ensureAdmin } from "./lib/firebaseAdmin";
import webauthnRouter from "./backend-api/webauthn";
import { initSentryServer, sentryRequestHandler, sentryErrorHandler, sentryCapture } from "./lib/sentryServer";
import { validateServerEnv } from "./lib/envValidation";
import menuIngestRouter from "./backend-api/menuIngest";

const log = logger.child({ module: "app" });

log.info("module loading…");

// Fail fast if required envs are missing (skips strict mode in tests)
validateServerEnv({ strict: process.env.NODE_ENV !== "test" });

// Pre-warm firebase-admin on cold start to trim first-request latency.
try {
  ensureAdmin();
} catch (e) {
  log.warn({ err: e }, "pre-warm ensureAdmin failed (will retry lazily)");
}

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
initSentryServer();
app.use(sentryRequestHandler());
const defaultOrigins = [
  "http://localhost:5173",
  "https://bitewise-five.vercel.app",
  "https://bitewise.vercel.app",
  "https://bite-wise.vercel.app",
];
const metricsKey = process.env.METRICS_TOKEN ? String(process.env.METRICS_TOKEN) : null;
const envOrigins =
  process.env.CLIENT_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const allowedOrigins = Array.from(
  new Set([...defaultOrigins, ...envOrigins, ...(vercelOrigin ? [vercelOrigin] : [])])
);

function isAllowedOrigin(origin?: string | null) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) callback(null, true);
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

app.get("/metrics", async (req, res) => {
  if (metricsKey && req.headers["x-metrics-key"] !== metricsKey) {
    return res.status(403).send("forbidden");
  }
  try {
    res.setHeader("Content-Type", metricsContentType());
    res.send(await renderMetrics());
  } catch (err: any) {
    log.error({ err }, "metrics endpoint failed");
    sentryCapture(err, { route: "metrics" });
    res.status(500).send("metrics unavailable");
  }
});

app.get("/api/debug/token", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match || !match[1]) {
      return res.status(400).json({ ok: false, error: "no bearer token" });
    }
    ensureAdmin();
    const timeoutMs = 5000;
    const decoded = await Promise.race([
      getAdminAuth().verifyIdToken(match[1], true),
      new Promise((_r, rej) => setTimeout(() => rej(new Error("verifyIdToken timeout")), timeoutMs)),
    ]);
    return res.json({ ok: true, decoded });
  } catch (err: any) {
    log.error({ err }, "debug token verification failed");
    return res.status(401).json({ ok: false, error: err?.message || "verify failed" });
  }
});

/* -------------------- Public Actowiz feed proxy -------------------- */
app.use("/api/actowiz", ensureAdminMiddleware, actowiz);

/* -------------------- Auth Mint Token -------------------- */
app.post("/api/auth/mintCustomToken", async (req, res) => {
  const timer = metricsTimer();
  let status = 200;
  try {
    log.debug("/api/auth/mintCustomToken hit");
    const allow = process.env.ALLOW_CUSTOM_TOKEN_MINT === "1";
    const sharedSecret = process.env.CUSTOM_TOKEN_MINT_SECRET || "";
    const providedSecret =
      (req.headers["x-bitewise-mint-secret"] as string | undefined) ||
      (typeof req.body?.secret === "string" ? req.body.secret : "");

    if (!allow || !sharedSecret || providedSecret !== sharedSecret) {
      status = 403;
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    ensureAdmin();
    const phone = String(req.body?.phone || "").trim();
    const uidFromBody = String(req.body?.uid || "").trim();
    if (!phone && !uidFromBody) {
      status = 400;
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
      status = 404;
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
    status = 500;
    log.error({ err }, "mintCustomToken error");
    sentryCapture(err, { route: "/api/auth/mintCustomToken" });
    return res.status(500).json({ ok: false, error: "internal error" });
  } finally {
    observeApi("auth_mint_token", "POST", status, timer);
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
const adminChain: Array<(req: Request, res: Response, next: NextFunction) => void> = [
  ensureAdminMiddleware,
  verifyAuth,
  requireAdminAccess,
];

/* -------------------- Secure routes -------------------- */
app.use("/api/user", ...secureChain, userRoutes);
app.use("/api/orders", ...secureChain, orders);
app.use("/api/leaderboard", ...secureChain, leaderboard);
app.use("/api/achievements", ...secureChain, achievements);
app.use("/api/missions", ...secureChain, missions);
app.use("/api/tasks", ...secureChain, tasks);
// Dishes search/proxy
import dishesRouter from "./backend-api/dishes";
app.use("/api/dishes", ...secureChain, dishesRouter);
app.use("/api/referral", ...secureChain, referral);
app.use("/api/ingest", ...secureChain, ingest);
app.use("/api/metrics/ingest", metricsIngest);
app.use("/api/analytics", ...adminChain, analytics);
app.use("/api/themes", themesRouter);
app.use("/api/admin/themes", ...adminChain, adminThemesRouter);
app.use("/api/feedback", ...secureChain, feedbackRouter);
// Menu ingest + price diff + push hook
app.use("/api/ingest/menu", ensureAdminMiddleware, menuIngestRouter);

/* -------------------- Push Registration -------------------- */
app.post("/api/push/register", ...secureChain, async (req, res) => {
  try {
    const uid = (req as any).user?.uid || (req as any).uid;
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

app.post("/api/push/sendTest", ...secureChain, async (req, res) => {
  try {
    const uid = (req as any).user?.uid || (req as any).uid;
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
    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });

    // Clean up invalid tokens
    const failures: string[] = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = (r.error as any)?.code || "";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
          failures.push(tokens[idx]);
        }
      }
    });
    if (failures.length) {
      const batch = getFirestore().batch();
      failures.forEach((t) => {
        const ref = getFirestore().collection("users").doc(uid).collection("devices").doc(t);
        batch.delete(ref);
      });
      await batch.commit().catch((e) => log.warn({ e, failures }, "push cleanup failed"));
    }

    res.json({ ok: true, sent: tokens.length, pruned: failures.length });
  } catch (err: any) {
    log.error({ err }, "push/sendTest error");
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

app.get("/api/push/status", ...secureChain, async (req, res) => {
  try {
    const uid = (req as any).user?.uid || (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const db = getFirestore();
    const snap = await db.collection("users").doc(uid).collection("devices").get();
    const now = Date.now();
    const stale: string[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      const ts = Date.parse(data?.updated_at || "");
      if (!ts || now - ts > 60 * 24 * 60 * 60 * 1000) {
        stale.push(d.id);
      }
    });
    if (stale.length) {
      const batch = db.batch();
      stale.forEach((id) => batch.delete(db.collection("users").doc(uid).collection("devices").doc(id)));
      await batch.commit().catch((e) => log.warn({ e, stale }, "push stale cleanup failed"));
    }
    const active = snap.docs.length - stale.length;
    return res.json({ ok: true, registered: active > 0, count: active });
  } catch (err: any) {
    log.error({ err }, "push/status error");
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

// Admin: cleanup stale push tokens across users (best-effort, limited scan)
app.post("/api/admin/push/cleanup", ...adminChain, async (_req, res) => {
  try {
    const db = getFirestore();
    const usersSnap = await db.collection("users").limit(500).get();
    let checkedUsers = 0;
    let removed = 0;
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    for (const userDoc of usersSnap.docs) {
      checkedUsers++;
      const devicesSnap = await db.collection("users").doc(userDoc.id).collection("devices").get();
      const batch = db.batch();
      let localRemovals = 0;
      devicesSnap.forEach((d) => {
        const ts = Date.parse(String((d.data() as any)?.updated_at || ""));
        if (!ts || ts < cutoff) {
          batch.delete(d.ref);
          localRemovals++;
        }
      });
      if (localRemovals > 0) {
        await batch.commit().catch((e) => log.warn({ e }, "push cleanup batch failed"));
        removed += localRemovals;
      }
    }
    log.info({ checkedUsers, removed }, "admin push cleanup completed");
    res.json({ ok: true, checkedUsers, removed });
  } catch (err: any) {
    log.error({ err }, "admin push cleanup failed");
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

// Cron-safe endpoint (e.g., Vercel Scheduled) using ADMIN_SHARED_SECRET
app.post("/api/cron/push/cleanup", async (req, res) => {
  try {
    const secret = process.env.ADMIN_SHARED_SECRET;
    const header = req.headers["x-admin-secret"];
    if (!secret || header !== secret) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const db = getFirestore();
    const usersSnap = await db.collection("users").limit(500).get();
    let checkedUsers = 0;
    let removed = 0;
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    for (const userDoc of usersSnap.docs) {
      checkedUsers++;
      const devicesSnap = await db.collection("users").doc(userDoc.id).collection("devices").get();
      const batch = db.batch();
      let localRemovals = 0;
      devicesSnap.forEach((d) => {
        const ts = Date.parse(String((d.data() as any)?.updated_at || ""));
        if (!ts || ts < cutoff) {
          batch.delete(d.ref);
          localRemovals++;
        }
      });
      if (localRemovals > 0) {
        await batch.commit().catch((e) => log.warn({ e }, "push cleanup batch failed"));
        removed += localRemovals;
      }
    }
    log.info({ checkedUsers, removed }, "cron push cleanup completed");
    res.json({ ok: true, checkedUsers, removed });
  } catch (err: any) {
    log.error({ err }, "cron push cleanup failed");
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

/* -------------------- Admin helpers -------------------- */
app.get("/api/admin/ping", ...adminChain, (req, res) => {
  const uid = (req as any).user?.uid || "admin";
  const method = (req as any).auth?.admin ? "claim" : "secret";
  res.json({ ok: true, uid, method });
});

// Fallback error handler to capture unexpected failures
app.use((err: any, _req: any, res: any, _next: any) => {
  log.error({ err }, "Unhandled API error");
  sentryCapture(err, { route: "unhandled" });
  res.status(500).json({ ok: false, error: "internal error" });
});

log.info("module loaded.");
export default app;

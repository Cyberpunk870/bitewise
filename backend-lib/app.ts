// backend-lib/app.ts
// Express app (no .listen here). Used by both local dev and Vercel serverless.

/// <reference path="../types/express/index.d.ts" />
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); // Vercel ignores .env.local; envs must be set in dashboard

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

import userRoutes from "./backend-api/user";
import orders from "./backend-api/orders";
import leaderboard from "./backend-api/leaderboard";
import achievements from "./backend-api/achievements";
import tasks from "./backend-api/tasks";
import { verifyAuth } from "./middleware/verifyAuth";

console.log("[server/app] module loading…");

/* -------------------- Firebase credential loader -------------------- */
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

/* -------------------- Firebase lazy init -------------------- */
function ensureAdmin() {
  const before = getApps().length;
  if (!before) {
    const sa = loadServiceAccount();
    initAdmin({ credential: cert(sa) });
    console.log("[server/app] firebase-admin initialised; apps after =", getApps().length);
  }
}

/* -------------------- Middleware -------------------- */
function ensureAdminMiddleware(_req: Request, _res: Response, next: NextFunction) {
  try {
    ensureAdmin();
  } catch (e) {
    console.error("[server/app] ensureAdminMiddleware error:", e);
  }
  next();
}

/* -------------------- App setup -------------------- */
const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "https://bitewise-five.vercel.app",
  "https://bitewise.vercel.app",
];
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
    console.log("[server/app] /api/auth/mintCustomToken hit");
    ensureAdmin();
    const phone = String(req.body?.phone || "").trim();
    if (!phone) return res.status(400).json({ ok: false, error: "phone required" });

    const db = getFirestore();
    const snap = await db.collection("users").where("phone", "==", phone).limit(1).get();
    if (snap.empty) return res.status(404).json({ ok: false, error: "no such user" });

    const uid = snap.docs[0].id;
    const token = await getAdminAuth().createCustomToken(uid, { phone });
    return res.json({ ok: true, token });
  } catch (err: any) {
    console.error("mintCustomToken error", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

/* -------------------- Secure Middleware -------------------- */
app.use("/api", ensureAdminMiddleware);
app.use("/api", verifyAuth);

/* -------------------- Route Mounting -------------------- */
app.use("/api/user", userRoutes);
app.use("/api/orders", orders);
app.use("/api/leaderboard", leaderboard);
app.use("/api/achievements", achievements);
app.use("/api/tasks", tasks);

/* -------------------- Push Registration -------------------- */
app.post("/api/push/register", async (req, res) => {
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
    console.error("push/register error", err);
    res.status(500).json({ ok: false, error: "internal error" });
  }
});

console.log("[server/app] module loaded.");
export default app;
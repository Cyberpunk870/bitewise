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
import path from "path";

const EMBEDDED_SERVICE_ACCOUNT_B64 =
  "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYml0ZXdpc2UtOTMiLAogICJwcml2YXRlX2tleV9pZCI6ICJjNjIzY2FmNmVhOWE4MjliM2JmZjQyMGJiZDVhZWZiZWY2M2NlZTcwIiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUURTUjRGRVhzOTdXNTVaXG5xbnRyMGE5OUgzZW5oS1EzOUk1RUZDT2RzNTNaaEE3Z0Uvck9NM0dIdmo0T2RReEEyRFlKMk5pTWVOaXpWbFlqXG5wQkVHMjM5cjY1ZjBORWNLWU9CTVBmdDBCeHhpUFlxUGhlY2dMTUtLME41SUFmbVlkdURoTlR3UVZiZnpsWkVxXG5rNlN0Q0xGSlRBS3UyNEdkV1phdjJYem84d1BSeldJcjZjenlTYzBoak8xVlJpd3Fzc1VaOTlVRDBiRlMydDA5XG5sSXlPM3JBeDVZUnFVSXFieCtPUVFUQ3hJSnVsdjRNY0RuaC9uVTV1N1FsUVVhbXY4V2JqYkxjQ3hnVDNIbUpvXG5kSlEvbGNSU0FjSU5Ea29hdE5TaFVCaUd6Z1VJR2lIR2l1V2c5SG8zSWFlT1Q0VVZqWVRuM3N3cDQvbUZKdXJNXG5SeU9pYVN2M0FnTUJBQUVDZ2dFQVZNaHYzbGs3M3NqNTk3MDlOaU85VmYyeUNPRDZOWFZ0UnhXM3BvWWRSdTV2XG44UGtkVHJaL04vUUVvVitnS1NVRDVNU0J5MkdPUGdDNWluVkVTRGVJRU1OVTZTbUsyeXhrUTFsYVlWWGNvOStjXG5Wbkh1MXBJMWZqTG83SytmSzFJREtjcUZCVEVLa2pQajYvN0xqdGpLWW5zN09iVlhkVklCNTdVUkgvdWJ0cU1WXG5mWTdKWGFNd3JuL2tydlRvc2NwdzBwS2lwS08xQlBQWnVNc1dKUjUrZ2dJVHAwYzZFTEFQMnBSYXBtc2NJNmErXG5iVlZVWDRRNmFEZytseUw3WXY2YnNYbC9tUHRqM2d3bnpHNE1rNm5KQWZadzEwcHFuV0xOSEVRUFE2Sms5UWQ3XG5Sc0VxK1VtWGpyRG9RY3BPR3c4TkRzZkFxTHJnTGlRRGVlYnRDT253Z1FLQmdRRHpDNng1dWV1QnY5M2ZvRVhaXG53R0NETXljSFN3c2V3cEZBZFY1R1ZSRFpCb0RRV1hGYTBBaTFEdk9NWnlqR1VnNFpvcHM2OVdhTExDUDdQeklOXG43TXpuRVZCa3hNNC9BbHN1UGlZNlcyQmYzQ3ltMmJ1cmN5emYvVVNFSENVUmlTejRYbnBrbVgzMmJEMHpQdGx5XG5HT1lZSXBrVzhOd3FPWFN3dEpQd1YwcVhQd0tCZ1FEZGZMMUwrQ1phRjFuRVVoYk5SaGlSYzNSS0RCd2ZUbzM4XG5KV2VBSHNtSzVrRERlZkRzSW5SaVFNY3lhQ090TVBGVmNFU2twd3BCalNvdVBOSTcxSS9iV293UzBaWWxxVVdxXG5ncHIrZndDa3dOem9PVllxb1lLOUZCdEhkUE84OEFxSWhjaVA5c0ZNbXlVR3hPODNTUEpmRXJzaVJKOC9ER2xIXG5YYjNVTWl3MVNRS0JnREJySXZFZEdNM0FhM01oZXNqbWlsT1kzUzJXeGFCYklwUzB6Uk0xM3lWZEpreGJoVG1TXG5PQ25aMEtzbjRmZWdZUzY2TmpLSXNPVUk1aUluZE5GUlc0Q3M4bGNnM2ZXdmducXo1dW01U25uT1l4YmFTWWplXG5hUkkyWW0vdkszTlM0S0thTDhmYXpEMUxVdVhpbjI4YmhydElLVGRveEhPay9wbzFYME9DSUZvQkFvR0JBTlcrXG5vYmdFM0k0bzVycHROaEFYeTNIaTU2RG1HdVdqbTZad09uZ01QaGZMcVVoOEQ2THloVHFrcFJmaUpEdnBkWjBzXG5ZVEk4K2NyVS9wWHNvRDZaSGROa2lMVklpZ3dDVlhiOTM3SW13bW84clhOMmtjOUdXck02Q2pGbGppc1J4RGlJXG5VMHVMcUhQVGJXSWcvM0pzOVdvRzI0MXdoL1lDZGo4bkdpRUQ0bUh4QW9HQUU0VVNPM1lKbTNBVjd0dTdjQmovXG5QTUF6YXEzVWFqYWFDaFFWRDgvWkxWbHRCZUR6NFdkSXF5N0VKSzRvalpOZTNZQlNFYXNubmJDZUhOQThycGNDXG55c2QyVGxWOUJSVThrNzhkZmNJSmxjMkNiTDFwTXpWaTBrVFRDUEZZOGNJVkQ2SkV5ZEU0enBPMlBEVUN2eG0rXG5RVlFLNXNiWW9YQm1ycGdrbVViNGlvND1cbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BiaXRld2lzZS05My5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMDgyMzc2OTAyMjk4ODMwMDQ3MjgiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwYml0ZXdpc2UtOTMuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K";

import userRoutes from "./backend-api/user";
import orders from "./backend-api/orders";
import leaderboard from "./backend-api/leaderboard";
import achievements from "./backend-api/achievements";
import tasks from "./backend-api/tasks";
import ingest from "./backend-api/ingest";
import analytics from "./backend-api/analytics";
import { verifyAuth } from "./middleware/verifyAuth";

console.log("[server/app] module loading…");

/* -------------------- Firebase credential loader -------------------- */
function massagePrivateKey<T extends { private_key?: string }>(sa: T): T {
  if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  return sa;
}

function tryReadJsonFile(saPath: string | undefined) {
  if (!saPath) return null;
  try {
    if (!fs.existsSync(saPath)) return null;
    console.log("[server/app] using service account file:", saPath);
    const raw = fs.readFileSync(saPath, "utf8");
    return massagePrivateKey(JSON.parse(raw));
  } catch (e) {
    console.error("[server/app] failed to read/parse SA file:", e);
    throw e;
  }
}

function tryParseJsonEnv(value: string | undefined, label: string) {
  if (!value) return null;
  try {
    console.log(`[server/app] using ${label} (len=${value.length})`);
    return massagePrivateKey(JSON.parse(value));
  } catch (e) {
    console.error(`[server/app] ${label} parse failed:`, e);
    throw e;
  }
}

function loadServiceAccount(): ServiceAccount {
  console.log("[server/app] process cwd", process.cwd());
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(process.cwd(), "firebase", "service-account.json"),
    path.join(__dirname, "..", "firebase", "service-account.json"),
    path.join(__dirname, "..", "..", "firebase", "service-account.json"),
  ];
  console.log("[server/app] checking service account paths", candidatePaths);
  for (const p of candidatePaths) {
    const sa = tryReadJsonFile(p);
    if (sa) return sa as ServiceAccount;
  }

  const json = tryParseJsonEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "FIREBASE_SERVICE_ACCOUNT_JSON");
  if (json) return json as ServiceAccount;

  const jsonB64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8")
    : undefined;
  const fromB64 = tryParseJsonEnv(jsonB64, "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
  if (fromB64) return fromB64 as ServiceAccount;

  if (EMBEDDED_SERVICE_ACCOUNT_B64) {
    try {
      const decoded = Buffer.from(EMBEDDED_SERVICE_ACCOUNT_B64, "base64").toString("utf8");
      const parsed = massagePrivateKey(JSON.parse(decoded));
      console.log("[server/app] using embedded service account fallback");
      return parsed as ServiceAccount;
    } catch (err) {
      console.error("[server/app] embedded service account decode failed:", err);
    }
  }

  console.error("[server/app] missing Firebase credentials.");
  throw new Error(
    "Missing Firebase credentials. Provide FIREBASE_SERVICE_ACCOUNT_PATH, JSON, or JSON_BASE64."
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
    console.log("[server/app] /api/auth/mintCustomToken hit");
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
    console.error("mintCustomToken error", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

app.get("/api/public/check-phone", async (req, res) => {
  try {
    ensureAdmin();
    const raw = typeof req.query?.phone === "string" ? req.query.phone : "";
    const phone = raw.replace(/\s+/g, "");
    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone required" });
    }
    const snap = await getFirestore()
      .collection("users")
      .where("phone", "==", phone)
      .limit(1)
      .get();
    return res.json({ ok: true, exists: !snap.empty });
  } catch (err: any) {
    console.error("[public/check-phone] error", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal error" });
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
app.use("/api/ingest", ingest);
app.use("/api/analytics", analytics);

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

app.post("/api/push/sendTest", async (req, res) => {
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
    console.error("push/sendTest error", err);
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

console.log("[server/app] module loaded.");
export default app;

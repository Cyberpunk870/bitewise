"use strict";
// backend-lib/app.ts
// Express app (no .listen here). Used by both local dev and Vercel serverless.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load .env.local if dotenv is available; swallow missing module in serverless bundle.
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require("dotenv");
    dotenv.config({ path: ".env.local" }); // Vercel ignores .env.local; envs must be set in dashboard
}
catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[app] dotenv not loaded (likely not bundled in serverless)", err && err.message);
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const morgan_1 = __importDefault(require("morgan"));
// --- Firebase Admin (lazy init) ---
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const messaging_1 = require("firebase-admin/messaging");
const user_1 = __importDefault(require("./backend-api/user"));
const orders_1 = __importDefault(require("./backend-api/orders"));
const leaderboard_1 = __importDefault(require("./backend-api/leaderboard"));
const achievements_1 = __importDefault(require("./backend-api/achievements"));
const tasks_1 = __importDefault(require("./backend-api/tasks"));
const ingest_1 = __importDefault(require("./backend-api/ingest"));
const actowiz_1 = __importDefault(require("./backend-api/actowiz"));
const metricsIngest_1 = __importDefault(require("./backend-api/metricsIngest"));
const referral_1 = __importDefault(require("./backend-api/referral"));
const analytics_1 = __importDefault(require("./backend-api/analytics"));
const missions_1 = __importDefault(require("./backend-api/missions"));
const themes_1 = __importStar(require("./backend-api/themes"));
const feedback_1 = __importDefault(require("./backend-api/feedback"));
const verifyAuth_1 = require("./middleware/verifyAuth");
const logger_1 = __importDefault(require("./lib/logger"));
const metrics_1 = require("./lib/metrics");
const firebaseAdmin_1 = require("./lib/firebaseAdmin");
const webauthn_1 = __importDefault(require("./backend-api/webauthn"));
const sentryServer_1 = require("./lib/sentryServer");
const envValidation_1 = require("./lib/envValidation");
const menuIngest_1 = __importDefault(require("./backend-api/menuIngest"));
const log = logger_1.default.child({ module: "app" });
log.info("module loading…");
// Fail fast if required envs are missing (skips strict mode in tests)
(0, envValidation_1.validateServerEnv)({ strict: process.env.NODE_ENV !== "test" });
// Pre-warm firebase-admin on cold start to trim first-request latency.
try {
    (0, firebaseAdmin_1.ensureAdmin)();
}
catch (e) {
    log.warn({ err: e }, "pre-warm ensureAdmin failed (will retry lazily)");
}
/* -------------------- Middleware -------------------- */
function ensureAdminMiddleware(_req, _res, next) {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
    }
    catch (e) {
        log.error({ err: e }, "ensureAdminMiddleware error");
    }
    next();
}
/* -------------------- App setup -------------------- */
const app = (0, express_1.default)();
(0, sentryServer_1.initSentryServer)();
app.use((0, sentryServer_1.sentryRequestHandler)());
const defaultOrigins = [
    "http://localhost:5173",
    "https://bitewise-five.vercel.app",
    "https://bitewise.vercel.app",
    "https://bite-wise.vercel.app",
];
const metricsKey = process.env.METRICS_TOKEN ? String(process.env.METRICS_TOKEN) : null;
const envOrigins = process.env.CLIENT_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins, ...(vercelOrigin ? [vercelOrigin] : [])]));
function isAllowedOrigin(origin) {
    if (!origin)
        return true;
    return allowedOrigins.includes(origin);
}
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin))
            callback(null, true);
        else
            callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(body_parser_1.default.json());
app.use((0, morgan_1.default)("tiny"));
/* -------------------- Health -------------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true, status: "server running", admin_ready: (0, app_1.getApps)().length > 0 }));
app.get("/api/ready", (_req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const ready = (0, app_1.getApps)().length > 0;
        res.status(ready ? 200 : 503).json({
            ok: ready,
            admin_ready: ready,
            has_sa_json: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
        });
    }
    catch (e) {
        res.status(503).json({ ok: false, error: String(e?.message || e) });
    }
});
app.get("/metrics", async (req, res) => {
    if (metricsKey && req.headers["x-metrics-key"] !== metricsKey) {
        return res.status(403).send("forbidden");
    }
    try {
        res.setHeader("Content-Type", (0, metrics_1.metricsContentType)());
        res.send(await (0, metrics_1.renderMetrics)());
    }
    catch (err) {
        log.error({ err }, "metrics endpoint failed");
        (0, sentryServer_1.sentryCapture)(err, { route: "metrics" });
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
        (0, firebaseAdmin_1.ensureAdmin)();
        const timeoutMs = 5000;
        const decoded = await Promise.race([
            (0, auth_1.getAuth)().verifyIdToken(match[1], true),
            new Promise((_r, rej) => setTimeout(() => rej(new Error("verifyIdToken timeout")), timeoutMs)),
        ]);
        return res.json({ ok: true, decoded });
    }
    catch (err) {
        log.error({ err }, "debug token verification failed");
        return res.status(401).json({ ok: false, error: err?.message || "verify failed" });
    }
});
/* -------------------- Public Actowiz feed proxy -------------------- */
app.use("/api/actowiz", ensureAdminMiddleware, actowiz_1.default);
/* -------------------- Auth Mint Token -------------------- */
app.post("/api/auth/mintCustomToken", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        log.debug("/api/auth/mintCustomToken hit");
        const allow = process.env.ALLOW_CUSTOM_TOKEN_MINT === "1";
        const sharedSecret = process.env.CUSTOM_TOKEN_MINT_SECRET || "";
        const providedSecret = req.headers["x-bitewise-mint-secret"] ||
            (typeof req.body?.secret === "string" ? req.body.secret : "");
        if (!allow || !sharedSecret || providedSecret !== sharedSecret) {
            status = 403;
            return res.status(403).json({ ok: false, error: "forbidden" });
        }
        (0, firebaseAdmin_1.ensureAdmin)();
        const phone = String(req.body?.phone || "").trim();
        const uidFromBody = String(req.body?.uid || "").trim();
        if (!phone && !uidFromBody) {
            status = 400;
            return res.status(400).json({ ok: false, error: "phone or uid required" });
        }
        const db = (0, firestore_1.getFirestore)();
        const adminAuth = (0, auth_1.getAuth)();
        let targetUid = uidFromBody;
        if (!targetUid && phone) {
            try {
                const authUser = await adminAuth.getUserByPhoneNumber(phone);
                targetUid = authUser.uid;
            }
            catch {
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
    }
    catch (err) {
        status = 500;
        log.error({ err }, "mintCustomToken error");
        (0, sentryServer_1.sentryCapture)(err, { route: "/api/auth/mintCustomToken" });
        return res.status(500).json({ ok: false, error: "internal error" });
    }
    finally {
        (0, metrics_1.observeApi)("auth_mint_token", "POST", status, timer);
    }
});
app.use("/api/auth/webauthn", webauthn_1.default);
app.get("/api/public/check-phone", async (req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const raw = typeof req.query?.phone === "string" ? req.query.phone : "";
        const phone = raw.replace(/\s+/g, "");
        const rawMode = typeof req.query?.mode === "string" ? req.query.mode : "";
        const mode = rawMode === "signup" || rawMode === "login" ? rawMode : null;
        if (!phone) {
            return res.status(400).json({ ok: false, error: "phone required" });
        }
        const snap = await (0, firestore_1.getFirestore)()
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
    }
    catch (err) {
        log.error({ err }, "[public/check-phone] error");
        return res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
/* -------------------- Secure middlewares -------------------- */
const secureChain = [
    ensureAdminMiddleware,
    verifyAuth_1.verifyAuth,
];
const adminChain = [
    ensureAdminMiddleware,
    verifyAuth_1.verifyAuth,
    verifyAuth_1.requireAdminAccess,
];
/* -------------------- Secure routes -------------------- */
app.use("/api/user", ...secureChain, user_1.default);
app.use("/api/orders", ...secureChain, orders_1.default);
app.use("/api/leaderboard", ...secureChain, leaderboard_1.default);
app.use("/api/achievements", ...secureChain, achievements_1.default);
app.use("/api/missions", ...secureChain, missions_1.default);
app.use("/api/tasks", ...secureChain, tasks_1.default);
app.use("/api/referral", ...secureChain, referral_1.default);
app.use("/api/ingest", ...secureChain, ingest_1.default);
app.use("/api/metrics/ingest", metricsIngest_1.default);
app.use("/api/analytics", ...adminChain, analytics_1.default);
app.use("/api/themes", themes_1.default);
app.use("/api/admin/themes", ...adminChain, themes_1.adminThemesRouter);
app.use("/api/feedback", ...secureChain, feedback_1.default);
// Menu ingest + price diff + push hook
app.use("/api/ingest/menu", ensureAdminMiddleware, menuIngest_1.default);
/* -------------------- Push Registration -------------------- */
app.post("/api/push/register", ...secureChain, async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const token = String(req.body?.token || "").trim();
        if (!token)
            return res.status(400).json({ ok: false, error: "token required" });
        const db = (0, firestore_1.getFirestore)();
        await db
            .collection("users")
            .doc(uid)
            .collection("devices")
            .doc(token)
            .set({ token, updated_at: new Date().toISOString(), active: true }, { merge: true });
        res.json({ ok: true });
    }
    catch (err) {
        log.error({ err }, "push/register error");
        res.status(500).json({ ok: false, error: "internal error" });
    }
});
app.post("/api/push/sendTest", ...secureChain, async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const db = (0, firestore_1.getFirestore)();
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
        const resp = await (0, messaging_1.getMessaging)().sendEachForMulticast({
            tokens,
            notification: { title, body },
        });
        // Clean up invalid tokens
        const failures = [];
        resp.responses.forEach((r, idx) => {
            if (!r.success) {
                const code = r.error?.code || "";
                if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
                    failures.push(tokens[idx]);
                }
            }
        });
        if (failures.length) {
            const batch = (0, firestore_1.getFirestore)().batch();
            failures.forEach((t) => {
                const ref = (0, firestore_1.getFirestore)().collection("users").doc(uid).collection("devices").doc(t);
                batch.delete(ref);
            });
            await batch.commit().catch((e) => log.warn({ e, failures }, "push cleanup failed"));
        }
        res.json({ ok: true, sent: tokens.length, pruned: failures.length });
    }
    catch (err) {
        log.error({ err }, "push/sendTest error");
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
app.get("/api/push/status", ...secureChain, async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const db = (0, firestore_1.getFirestore)();
        const snap = await db.collection("users").doc(uid).collection("devices").get();
        const now = Date.now();
        const stale = [];
        snap.docs.forEach((d) => {
            const data = d.data();
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
    }
    catch (err) {
        log.error({ err }, "push/status error");
        return res.status(500).json({ ok: false, error: "internal error" });
    }
});
// Admin: cleanup stale push tokens across users (best-effort, limited scan)
app.post("/api/admin/push/cleanup", ...adminChain, async (_req, res) => {
    try {
        const db = (0, firestore_1.getFirestore)();
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
                const ts = Date.parse(String(d.data()?.updated_at || ""));
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
    }
    catch (err) {
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
        const db = (0, firestore_1.getFirestore)();
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
                const ts = Date.parse(String(d.data()?.updated_at || ""));
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
    }
    catch (err) {
        log.error({ err }, "cron push cleanup failed");
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
/* -------------------- Admin helpers -------------------- */
app.get("/api/admin/ping", ...adminChain, (req, res) => {
    const uid = req.user?.uid || "admin";
    const method = req.auth?.admin ? "claim" : "secret";
    res.json({ ok: true, uid, method });
});
// Fallback error handler to capture unexpected failures
app.use((err, _req, res, _next) => {
    log.error({ err }, "Unhandled API error");
    (0, sentryServer_1.sentryCapture)(err, { route: "unhandled" });
    res.status(500).json({ ok: false, error: "internal error" });
});
log.info("module loaded.");
exports.default = app;

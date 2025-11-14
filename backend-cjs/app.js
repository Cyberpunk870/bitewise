"use strict";
// backend-lib/app.ts
// Express app (no .listen here). Used by both local dev and Vercel serverless.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="../types/express/index.d.ts" />
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env.local" }); // Vercel ignores .env.local; envs must be set in dashboard
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const morgan_1 = __importDefault(require("morgan"));
// --- Firebase Admin (lazy init) ---
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const messaging_1 = require("firebase-admin/messaging");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const EMBEDDED_SERVICE_ACCOUNT_B64 = "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYml0ZXdpc2UtOTMiLAogICJwcml2YXRlX2tleV9pZCI6ICJjNjIzY2FmNmVhOWE4MjliM2JmZjQyMGJiZDVhZWZiZWY2M2NlZTcwIiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUURTUjRGRVhzOTdXNTVaXG5xbnRyMGE5OUgzZW5oS1EzOUk1RUZDT2RzNTNaaEE3Z0Uvck9NM0dIdmo0T2RReEEyRFlKMk5pTWVOaXpWbFlqXG5wQkVHMjM5cjY1ZjBORWNLWU9CTVBmdDBCeHhpUFlxUGhlY2dMTUtLME41SUFmbVlkdURoTlR3UVZiZnpsWkVxXG5rNlN0Q0xGSlRBS3UyNEdkV1phdjJYem84d1BSeldJcjZjenlTYzBoak8xVlJpd3Fzc1VaOTlVRDBiRlMydDA5XG5sSXlPM3JBeDVZUnFVSXFieCtPUVFUQ3hJSnVsdjRNY0RuaC9uVTV1N1FsUVVhbXY4V2JqYkxjQ3hnVDNIbUpvXG5kSlEvbGNSU0FjSU5Ea29hdE5TaFVCaUd6Z1VJR2lIR2l1V2c5SG8zSWFlT1Q0VVZqWVRuM3N3cDQvbUZKdXJNXG5SeU9pYVN2M0FnTUJBQUVDZ2dFQVZNaHYzbGs3M3NqNTk3MDlOaU85VmYyeUNPRDZOWFZ0UnhXM3BvWWRSdTV2XG44UGtkVHJaL04vUUVvVitnS1NVRDVNU0J5MkdPUGdDNWluVkVTRGVJRU1OVTZTbUsyeXhrUTFsYVlWWGNvOStjXG5Wbkh1MXBJMWZqTG83SytmSzFJREtjcUZCVEVLa2pQajYvN0xqdGpLWW5zN09iVlhkVklCNTdVUkgvdWJ0cU1WXG5mWTdKWGFNd3JuL2tydlRvc2NwdzBwS2lwS08xQlBQWnVNc1dKUjUrZ2dJVHAwYzZFTEFQMnBSYXBtc2NJNmErXG5iVlZVWDRRNmFEZytseUw3WXY2YnNYbC9tUHRqM2d3bnpHNE1rNm5KQWZadzEwcHFuV0xOSEVRUFE2Sms5UWQ3XG5Sc0VxK1VtWGpyRG9RY3BPR3c4TkRzZkFxTHJnTGlRRGVlYnRDT253Z1FLQmdRRHpDNng1dWV1QnY5M2ZvRVhaXG53R0NETXljSFN3c2V3cEZBZFY1R1ZSRFpCb0RRV1hGYTBBaTFEdk9NWnlqR1VnNFpvcHM2OVdhTExDUDdQeklOXG43TXpuRVZCa3hNNC9BbHN1UGlZNlcyQmYzQ3ltMmJ1cmN5emYvVVNFSENVUmlTejRYbnBrbVgzMmJEMHpQdGx5XG5HT1lZSXBrVzhOd3FPWFN3dEpQd1YwcVhQd0tCZ1FEZGZMMUwrQ1phRjFuRVVoYk5SaGlSYzNSS0RCd2ZUbzM4XG5KV2VBSHNtSzVrRERlZkRzSW5SaVFNY3lhQ090TVBGVmNFU2twd3BCalNvdVBOSTcxSS9iV293UzBaWWxxVVdxXG5ncHIrZndDa3dOem9PVllxb1lLOUZCdEhkUE84OEFxSWhjaVA5c0ZNbXlVR3hPODNTUEpmRXJzaVJKOC9ER2xIXG5YYjNVTWl3MVNRS0JnREJySXZFZEdNM0FhM01oZXNqbWlsT1kzUzJXeGFCYklwUzB6Uk0xM3lWZEpreGJoVG1TXG5PQ25aMEtzbjRmZWdZUzY2TmpLSXNPVUk1aUluZE5GUlc0Q3M4bGNnM2ZXdmducXo1dW01U25uT1l4YmFTWWplXG5hUkkyWW0vdkszTlM0S0thTDhmYXpEMUxVdVhpbjI4YmhydElLVGRveEhPay9wbzFYME9DSUZvQkFvR0JBTlcrXG5vYmdFM0k0bzVycHROaEFYeTNIaTU2RG1HdVdqbTZad09uZ01QaGZMcVVoOEQ2THloVHFrcFJmaUpEdnBkWjBzXG5ZVEk4K2NyVS9wWHNvRDZaSGROa2lMVklpZ3dDVlhiOTM3SW13bW84clhOMmtjOUdXck02Q2pGbGppc1J4RGlJXG5VMHVMcUhQVGJXSWcvM0pzOVdvRzI0MXdoL1lDZGo4bkdpRUQ0bUh4QW9HQUU0VVNPM1lKbTNBVjd0dTdjQmovXG5QTUF6YXEzVWFqYWFDaFFWRDgvWkxWbHRCZUR6NFdkSXF5N0VKSzRvalpOZTNZQlNFYXNubmJDZUhOQThycGNDXG55c2QyVGxWOUJSVThrNzhkZmNJSmxjMkNiTDFwTXpWaTBrVFRDUEZZOGNJVkQ2SkV5ZEU0enBPMlBEVUN2eG0rXG5RVlFLNXNiWW9YQm1ycGdrbVViNGlvND1cbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BiaXRld2lzZS05My5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMDgyMzc2OTAyMjk4ODMwMDQ3MjgiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwYml0ZXdpc2UtOTMuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K";
const user_1 = __importDefault(require("./backend-api/user"));
const orders_1 = __importDefault(require("./backend-api/orders"));
const leaderboard_1 = __importDefault(require("./backend-api/leaderboard"));
const achievements_1 = __importDefault(require("./backend-api/achievements"));
const tasks_1 = __importDefault(require("./backend-api/tasks"));
const ingest_1 = __importDefault(require("./backend-api/ingest"));
const verifyAuth_1 = require("./middleware/verifyAuth");
console.log("[server/app] module loading…");
/* -------------------- Firebase credential loader -------------------- */
function massagePrivateKey(sa) {
    if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
        sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    }
    return sa;
}
function tryReadJsonFile(saPath) {
    if (!saPath)
        return null;
    try {
        if (!fs_1.default.existsSync(saPath))
            return null;
        console.log("[server/app] using service account file:", saPath);
        const raw = fs_1.default.readFileSync(saPath, "utf8");
        return massagePrivateKey(JSON.parse(raw));
    }
    catch (e) {
        console.error("[server/app] failed to read/parse SA file:", e);
        throw e;
    }
}
function tryParseJsonEnv(value, label) {
    if (!value)
        return null;
    try {
        console.log(`[server/app] using ${label} (len=${value.length})`);
        return massagePrivateKey(JSON.parse(value));
    }
    catch (e) {
        console.error(`[server/app] ${label} parse failed:`, e);
        throw e;
    }
}
function loadServiceAccount() {
    console.log("[server/app] process cwd", process.cwd());
    const candidatePaths = [
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        path_1.default.join(process.cwd(), "firebase", "service-account.json"),
        path_1.default.join(__dirname, "..", "firebase", "service-account.json"),
        path_1.default.join(__dirname, "..", "..", "firebase", "service-account.json"),
    ];
    console.log("[server/app] checking service account paths", candidatePaths);
    for (const p of candidatePaths) {
        const sa = tryReadJsonFile(p);
        if (sa)
            return sa;
    }
    const json = tryParseJsonEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "FIREBASE_SERVICE_ACCOUNT_JSON");
    if (json)
        return json;
    const jsonB64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
        ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8")
        : undefined;
    const fromB64 = tryParseJsonEnv(jsonB64, "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
    if (fromB64)
        return fromB64;
    if (EMBEDDED_SERVICE_ACCOUNT_B64) {
        try {
            const decoded = Buffer.from(EMBEDDED_SERVICE_ACCOUNT_B64, "base64").toString("utf8");
            const parsed = massagePrivateKey(JSON.parse(decoded));
            console.log("[server/app] using embedded service account fallback");
            return parsed;
        }
        catch (err) {
            console.error("[server/app] embedded service account decode failed:", err);
        }
    }
    console.error("[server/app] missing Firebase credentials.");
    throw new Error("Missing Firebase credentials. Provide FIREBASE_SERVICE_ACCOUNT_PATH, JSON, or JSON_BASE64.");
}
/* -------------------- Firebase lazy init -------------------- */
function ensureAdmin() {
    const before = (0, app_1.getApps)().length;
    if (!before) {
        const sa = loadServiceAccount();
        (0, app_1.initializeApp)({ credential: (0, app_1.cert)(sa) });
        console.log("[server/app] firebase-admin initialised; apps after =", (0, app_1.getApps)().length);
    }
}
/* -------------------- Middleware -------------------- */
function ensureAdminMiddleware(_req, _res, next) {
    try {
        ensureAdmin();
    }
    catch (e) {
        console.error("[server/app] ensureAdminMiddleware error:", e);
    }
    next();
}
/* -------------------- App setup -------------------- */
const app = (0, express_1.default)();
const defaultOrigins = [
    "http://localhost:5173",
    "https://bitewise-five.vercel.app",
    "https://bitewise.vercel.app",
];
const envOrigins = process.env.CLIENT_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins, ...(vercelOrigin ? [vercelOrigin] : [])]));
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin))
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
        ensureAdmin();
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
        console.error("mintCustomToken error", err);
        return res.status(500).json({ ok: false, error: "internal error" });
    }
});
/* -------------------- Secure Middleware -------------------- */
app.use("/api", ensureAdminMiddleware);
app.use("/api", verifyAuth_1.verifyAuth);
/* -------------------- Route Mounting -------------------- */
app.use("/api/user", user_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/leaderboard", leaderboard_1.default);
app.use("/api/achievements", achievements_1.default);
app.use("/api/tasks", tasks_1.default);
app.use("/api/ingest", ingest_1.default);
/* -------------------- Push Registration -------------------- */
app.post("/api/push/register", async (req, res) => {
    try {
        const uid = req.uid;
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
        console.error("push/register error", err);
        res.status(500).json({ ok: false, error: "internal error" });
    }
});
app.post("/api/push/sendTest", async (req, res) => {
    try {
        const uid = req.uid;
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
        await (0, messaging_1.getMessaging)().sendEachForMulticast({
            tokens,
            notification: { title, body },
        });
        res.json({ ok: true, sent: tokens.length });
    }
    catch (err) {
        console.error("push/sendTest error", err);
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
console.log("[server/app] module loaded.");
exports.default = app;

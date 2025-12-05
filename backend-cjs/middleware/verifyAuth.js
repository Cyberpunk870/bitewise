"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = verifyAuth;
exports.requireAdminAccess = requireAdminAccess;
const auth_1 = require("firebase-admin/auth");
const logger_1 = __importDefault(require("../lib/logger"));
const firebaseAdmin_1 = require("../lib/firebaseAdmin");
const log = logger_1.default.child({ module: "verifyAuth" });
async function verifyAuth(req, res, next) {
    try {
        // Allow admin shared secret to bypass Firebase verification (for server-to-server scripts).
        const adminSecret = process.env.ADMIN_SHARED_SECRET;
        const headerSecret = typeof req.headers["x-admin-secret"] === "string" ? req.headers["x-admin-secret"] : null;
        if (adminSecret && headerSecret && headerSecret === adminSecret) {
            req.user = { uid: "admin-shared-secret" };
            req.auth = { admin: true };
            return next();
        }
        const authHeader = req.headers.authorization || "";
        const match = authHeader.match(/^Bearer (.+)$/);
        if (!match || !match[1]) {
            log.warn("Missing or invalid auth token");
            return res.status(401).json({ ok: false, error: "missing or invalid auth token" });
        }
        const idToken = match[1];
        (0, firebaseAdmin_1.ensureAdmin)();
        const adminAuth = (0, auth_1.getAuth)();
        const timeoutMs = 5000;
        const decoded = (await Promise.race([
            adminAuth.verifyIdToken(idToken, false),
            new Promise((_res, rej) => setTimeout(() => rej(new Error("verifyIdToken timeout")), timeoutMs)),
        ]));
        // ✅ Attach user object (not just uid)
        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name
        };
        req.auth = decoded;
        next();
    }
    catch (err) {
        const code = err?.code || err?.message || "unauthorized";
        log.error({ err, code }, "Auth error");
        return res.status(401).json({ ok: false, error: String(code) });
    }
}
function requireAdminAccess(req, res, next) {
    try {
        const claims = req.auth;
        const hasClaim = claims?.admin === true;
        if (hasClaim)
            return next();
        const adminSecret = process.env.ADMIN_SHARED_SECRET;
        const headerSecret = typeof req.headers["x-admin-secret"] === "string" ? req.headers["x-admin-secret"] : null;
        if (adminSecret && headerSecret === adminSecret)
            return next();
        log.warn({ uid: req.user?.uid, hasClaim, hasSecret: Boolean(headerSecret) }, "admin access denied");
        return res.status(403).json({ ok: false, error: "admin access required" });
    }
    catch (err) {
        log.error({ err }, "requireAdminAccess error");
        return res.status(403).json({ ok: false, error: "admin access required" });
    }
}

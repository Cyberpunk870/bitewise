"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = verifyAuth;
const auth_1 = require("firebase-admin/auth");
async function verifyAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        const match = authHeader.match(/^Bearer (.+)$/);
        if (!match || !match[1]) {
            console.warn("[verifyAuth] Missing or invalid auth token");
            return res.status(401).json({ ok: false, error: "missing or invalid auth token" });
        }
        const idToken = match[1];
        const adminAuth = (0, auth_1.getAuth)();
        const decoded = await adminAuth.verifyIdToken(idToken, true);
        // ✅ Attach user object (not just uid)
        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name
        };
        next();
    }
    catch (err) {
        console.error("[verifyAuth] Auth error:", err?.message || err);
        return res.status(401).json({ ok: false, error: "unauthorized" });
    }
}

"use strict";
// bitewise/backend-lib/backend-api/auth.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintCustomTokenDev = mintCustomTokenDev;
const auth_1 = require("firebase-admin/auth");
/**
 * DEV-ONLY helper:
 * Given some identifier from the client, mint a Firebase custom token.
 *
 * Right now we're being intentionally lenient so you can unblock local
 * passkey-unlock flow. We'll HARDEN this later.
 *
 * Rules right now:
 *   - Accepts { uid } in body. We treat that as the Firebase uid.
 *   - If ALLOW_DEV_PASSKEY_REAUTH is not truthy, we refuse.
 *   - We do NOT verify any passkey proof here yet. (coming next)
 */
async function mintCustomTokenDev(uidRaw) {
    // Safety gate: don't allow this unless explicitly enabled.
    const allow = process.env.ALLOW_DEV_PASSKEY_REAUTH;
    if (!allow) {
        return {
            ok: false,
            error: "passkey reauth disabled on this server. Set ALLOW_DEV_PASSKEY_REAUTH=1 for local dev.",
            token: null,
        };
    }
    // For now we just trust the uid passed in.
    // In production, uid MUST come from verified JWT / stored mapping, etc.
    const uid = typeof uidRaw === "string" ? uidRaw.trim() : "";
    if (!uid) {
        return { ok: false, error: "uid required", token: null };
    }
    try {
        const token = await (0, auth_1.getAuth)().createCustomToken(uid);
        return { ok: true, token };
    }
    catch (err) {
        return {
            ok: false,
            error: String(err?.message || err || "could not mint custom token"),
            token: null,
        };
    }
}

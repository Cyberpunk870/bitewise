"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const firebaseAdmin_1 = require("../lib/firebaseAdmin");
const coins_1 = require("./user/coins");
const router = (0, express_1.Router)();
const REFERRALS = "referrals";
const REDEMPTIONS = "referral_redemptions";
const MAX_USES_DEFAULT = 3; // cap redemptions per code
const REFERRER_REWARD = 50;
const REFEREE_REWARD = 25;
function genCode(uid) {
    const base = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${base.slice(0, 4)}${suffix}`;
}
// POST /api/referral/create
router.post("/create", async (req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const db = (0, firestore_1.getFirestore)();
        // Reuse existing code if present
        const existing = await db.collection(REFERRALS).where("referrerUid", "==", uid).limit(1).get();
        if (!existing.empty) {
            const doc = existing.docs[0];
            const data = doc.data() || {};
            return res.json({
                ok: true,
                code: data.code,
                uses: data.uses || 0,
                uses_limit: data.uses_limit || MAX_USES_DEFAULT,
            });
        }
        let code = "";
        for (let i = 0; i < 5; i++) {
            code = genCode(uid);
            const dup = await db.collection(REFERRALS).doc(code).get();
            if (!dup.exists)
                break;
            code = "";
        }
        if (!code)
            return res.status(500).json({ ok: false, error: "could not allocate code" });
        await db.collection(REFERRALS).doc(code).set({
            referrerUid: uid,
            code,
            created_at: new Date().toISOString(),
            uses: 0,
            uses_limit: MAX_USES_DEFAULT,
        });
        return res.json({ ok: true, code, uses: 0, uses_limit: MAX_USES_DEFAULT });
    }
    catch (err) {
        return res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
// POST /api/referral/redeem { code }
router.post("/redeem", async (req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const code = String(req.body?.code || "").trim().toUpperCase();
        if (!code)
            return res.status(400).json({ ok: false, error: "code required" });
        const db = (0, firestore_1.getFirestore)();
        const codeDoc = await db.collection(REFERRALS).doc(code).get();
        if (!codeDoc.exists)
            return res.status(404).json({ ok: false, error: "invalid code" });
        const data = codeDoc.data() || {};
        const referrerUid = data.referrerUid;
        if (!referrerUid || referrerUid === uid) {
            return res.status(400).json({ ok: false, error: "cannot redeem this code" });
        }
        const uses = Number(data.uses || 0);
        const limit = Number(data.uses_limit || MAX_USES_DEFAULT);
        if (uses >= limit)
            return res.status(400).json({ ok: false, error: "code exhausted" });
        const redemptionId = uid; // one redemption per user
        const redemptionRef = db.collection(REDEMPTIONS).doc(redemptionId);
        const existing = await redemptionRef.get();
        if (existing.exists) {
            return res.status(400).json({ ok: false, error: "already redeemed" });
        }
        await db.runTransaction(async (tx) => {
            const codeSnap = await tx.get(db.collection(REFERRALS).doc(code));
            if (!codeSnap.exists)
                throw new Error("invalid code");
            const cdata = codeSnap.data() || {};
            const curUses = Number(cdata.uses || 0);
            const curLimit = Number(cdata.uses_limit || MAX_USES_DEFAULT);
            if (curUses >= curLimit)
                throw new Error("code exhausted");
            tx.update(codeSnap.ref, { uses: firestore_1.FieldValue.increment(1), last_use_at: new Date().toISOString() });
            tx.set(redemptionRef, {
                uid,
                code,
                referrerUid,
                redeemed_at: new Date().toISOString(),
            });
        });
        // Rewards (best-effort; failures won't block redemption)
        try {
            await (0, coins_1.addCoins)({
                uid: referrerUid,
                amount: REFERRER_REWARD,
                reason: "referral_referrer_bonus",
                meta: { code, from: uid },
            });
            await (0, coins_1.addCoins)({
                uid,
                amount: REFEREE_REWARD,
                reason: "referral_redeemer_bonus",
                meta: { code, referrerUid },
            });
        }
        catch (e) {
            console.warn("[referral] reward grant failed", e);
        }
        return res.json({
            ok: true,
            code,
            referrerUid,
            rewards: { referrer: REFERRER_REWARD, redeemer: REFEREE_REWARD },
        });
    }
    catch (err) {
        const msg = err?.message || "internal error";
        if (msg === "code exhausted" || msg === "invalid code") {
            return res.status(400).json({ ok: false, error: msg });
        }
        if (msg === "already redeemed") {
            return res.status(400).json({ ok: false, error: msg });
        }
        return res.status(500).json({ ok: false, error: msg });
    }
});
// GET /api/referral/status
router.get("/status", async (req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const db = (0, firestore_1.getFirestore)();
        let code = "";
        let uses = 0;
        let uses_limit = MAX_USES_DEFAULT;
        const existing = await db.collection(REFERRALS).where("referrerUid", "==", uid).limit(1).get();
        if (!existing.empty) {
            const doc = existing.docs[0];
            const data = doc.data() || {};
            code = data.code || "";
            uses = data.uses || 0;
            uses_limit = data.uses_limit || MAX_USES_DEFAULT;
        }
        const redemption = await db.collection(REDEMPTIONS).doc(uid).get();
        const redeemed = redemption.exists ? redemption.data() : null;
        return res.json({
            ok: true,
            code: code || null,
            uses,
            uses_limit,
            redeemed,
            rewards: { referrer: REFERRER_REWARD, redeemer: REFEREE_REWARD },
        });
    }
    catch (err) {
        return res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
exports.default = router;

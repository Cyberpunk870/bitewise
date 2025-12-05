"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCoins = addCoins;
exports.getCoinsSummary = getCoinsSummary;
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const AddCoinsInput = zod_1.z.object({
    uid: zod_1.z.string().min(1),
    amount: zod_1.z.number().int().min(1),
    reason: zod_1.z.string().min(1), // e.g., "order_savings", "task_complete", "achievement"
    meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(), // flexible payload for auditing
    request_id: zod_1.z.string().optional(), // optional dedupe key
});
const DAILY_CAP = 30;
const MONTHLY_CAP = 500;
const REDEEM_RATIO = 0.8; // 80% of earned coins are redeemable
function startOfDay() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}
function startOfMonth() {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}
async function computeAggregates(uid) {
    const db = (0, firestore_1.getFirestore)();
    const sinceMonth = startOfMonth();
    const sinceDay = startOfDay();
    const snap = await db
        .collection("coins_history")
        .where("user_id", "==", uid)
        .where("timestamp", ">=", new Date(sinceMonth).toISOString())
        .get();
    let dailyEarned = 0;
    let monthlyEarned = 0;
    let redeemedThisMonth = 0;
    snap.forEach((doc) => {
        const data = doc.data();
        const amt = Number(data?.amount || 0);
        const ts = Date.parse(String(data?.timestamp || "")) || 0;
        if (ts >= sinceMonth)
            monthlyEarned += amt;
        if (ts >= sinceDay)
            dailyEarned += amt;
        const reason = String(data?.reason || "").toLowerCase();
        const isRedeem = reason.startsWith("redeem") || Boolean(data?.meta?.redeem === true);
        if (isRedeem && ts >= sinceMonth)
            redeemedThisMonth += Math.max(0, amt);
    });
    const redeemableCap = Math.floor(monthlyEarned * REDEEM_RATIO);
    return {
        dailyEarned,
        monthlyEarned,
        dailyRemaining: Math.max(0, DAILY_CAP - dailyEarned),
        monthlyRemaining: Math.max(0, MONTHLY_CAP - monthlyEarned),
        redeemableCap,
        redeemableRemaining: Math.max(0, redeemableCap - redeemedThisMonth),
    };
}
async function addCoins(raw) {
    const parsed = AddCoinsInput.parse(raw);
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.collection("users").doc(parsed.uid);
    const coinsRef = db
        .collection("coins_history")
        .doc(parsed.request_id || db.collection("_tmp").doc().id);
    const now = new Date().toISOString();
    const aggregates = await computeAggregates(parsed.uid);
    const { dailyRemaining, monthlyRemaining, redeemableRemaining } = aggregates;
    if (parsed.amount > dailyRemaining) {
        throw new Error(`daily cap reached; remaining today: ${dailyRemaining}`);
    }
    if (parsed.amount > monthlyRemaining) {
        throw new Error(`monthly cap reached; remaining this month: ${monthlyRemaining}`);
    }
    const isRedeem = parsed.reason.toLowerCase().startsWith("redeem") || parsed.meta?.redeem === true;
    if (isRedeem && parsed.amount > redeemableRemaining) {
        throw new Error(`redeemable cap reached; remaining this month: ${redeemableRemaining}`);
    }
    // Atomic transaction: safely increments coins and writes history
    await db.runTransaction(async (tx) => {
        // Optional: if you want strict idempotency, you could read coinsRef and early-return if exists
        tx.set(coinsRef, {
            id: coinsRef.id,
            user_id: parsed.uid,
            amount: parsed.amount,
            reason: parsed.reason,
            meta: parsed.meta ?? {},
            timestamp: now,
        });
        tx.set(userRef, {
            total_coins: firestore_1.FieldValue.increment(parsed.amount),
            updated_at: now,
        }, { merge: true });
    });
    const newSnap = await userRef.get();
    const new_total = newSnap.exists ? Number(newSnap.data()?.total_coins || 0) : 0;
    // Emit analytics event
    try {
        const ev = db.collection("analytics_events").doc();
        await ev.set({
            id: ev.id,
            uid: parsed.uid,
            name: parsed.reason.toLowerCase().startsWith("redeem") ? "coins_redeemed" : "coins_earned",
            props: { amount: parsed.amount, reason: parsed.reason, meta: parsed.meta || {} },
            ts: Date.now(),
            created_at: new Date().toISOString(),
        });
    }
    catch (e) {
        console.error("[coins] analytics emit failed", e);
    }
    return { ok: true, new_total, txn_id: coinsRef.id };
}
async function getCoinsSummary(uid) {
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const total_coins = userSnap.exists ? Number(userSnap.data()?.total_coins || 0) : 0;
    let dailyEarned = 0;
    let monthlyEarned = 0;
    let dailyRemaining = DAILY_CAP;
    let monthlyRemaining = MONTHLY_CAP;
    let redeemableCap = 0;
    let redeemableRemaining = 0;
    try {
        const aggregates = await computeAggregates(uid);
        ({
            dailyEarned,
            monthlyEarned,
            dailyRemaining,
            monthlyRemaining,
            redeemableCap,
            redeemableRemaining,
        } = aggregates);
    }
    catch (err) {
        // Most likely missing Firestore composite index (user_id + timestamp) — don't hard-fail the user.
        console.error("[coins] computeAggregates failed", err?.message || err);
    }
    return {
        ok: true,
        total_coins,
        dailyEarned,
        monthlyEarned,
        dailyRemaining,
        monthlyRemaining,
        dailyCap: DAILY_CAP,
        monthlyCap: MONTHLY_CAP,
        redeemableCap,
        redeemableRemaining,
    };
}

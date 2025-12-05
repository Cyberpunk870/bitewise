"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOutbound = markOutbound;
exports.markCompletion = markCompletion;
exports.getOrderEvents = getOrderEvents;
// bitewise/backend-lib/backend-api/orders.ts
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
const leaderboard_1 = require("./leaderboard");
const achievements_1 = require("./achievements");
const express_1 = __importDefault(require("express"));
const logger_1 = __importDefault(require("../lib/logger"));
const metrics_1 = require("../lib/metrics");
const log = logger_1.default.child({ module: "orders" });
/**
 * We accept a flexible payload because frontend can evolve.
 * We normalize it here before writing Firestore.
 */
const router = express_1.default.Router();
const Inbound = zod_1.z.object({
    platform: zod_1.z.string().optional(),
    partner: zod_1.z.string().optional(), // legacy alias
    restaurant: zod_1.z.string().optional(),
    restaurant_id: zod_1.z.string().optional(),
    dish_name: zod_1.z.string().optional(), // "Paneer Tikka Roll", or basket name
    compare_price: zod_1.z.number().min(0).optional(), // other platform total
    platform_price: zod_1.z.number().min(0).optional(), // chosen platform total
    total: zod_1.z.number().min(0).optional(), // chosen platform total (new field from Compare.tsx)
    otherTotal: zod_1.z.number().min(0).optional(), // the other platform's total
    delta: zod_1.z.number().optional(), // savings = otherTotal - total
    saved_amount: zod_1.z.number().min(0).optional(), // we'll compute if missing
    outcome: zod_1.z.enum(["saved", "missed", "viewed"]).optional(),
    redirected_at: zod_1.z.string().optional(),
    completed_at: zod_1.z.string().optional(),
});
function col() {
    return (0, firestore_1.getFirestore)().collection("order_events");
}
/**
 * User tapped "Order on Swiggy" / "Order on Zomato".
 * We log intent + pricing snapshot.
 */
async function markOutbound(raw, uid) {
    const input = Inbound.parse(raw);
    // normalize platform field
    const platform = input.platform ?? input.partner ?? "unknown";
    // --- money math / savings math (keep your logic) ---
    // saved_amount: prefer explicit. Otherwise derive from delta or totals.
    let saved_amount = input.saved_amount ?? 0;
    if (!Number.isFinite(saved_amount))
        saved_amount = 0;
    if (saved_amount === 0) {
        if (typeof input.delta === "number") {
            // frontend sometimes sends delta = otherTotal - total
            saved_amount = Math.max(0, input.delta);
        }
        else if (typeof input.otherTotal === "number" &&
            typeof input.total === "number") {
            saved_amount = Math.max(0, input.otherTotal - input.total);
        }
    }
    // compare_price: what the "other" platform would've cost
    const compare_price = typeof input.otherTotal === "number"
        ? input.otherTotal
        : typeof input.compare_price === "number"
            ? input.compare_price
            : 0;
    // platform_price: what we're actually paying on chosen platform
    const platform_price = typeof input.total === "number"
        ? input.total
        : typeof input.platform_price === "number"
            ? input.platform_price
            : 0;
    // --- timestamps / id ---
    const now = new Date().toISOString();
    const id = (0, crypto_1.randomUUID)();
    // Build a base doc with only required / always-safe fields.
    const base = {
        id,
        user_id: uid,
        platform,
        dish_name: input.dish_name || "basket",
        compare_price,
        platform_price,
        saved_amount,
        outcome: input.outcome ?? "saved",
        redirected_at: input.redirected_at ?? now,
        created_at: now,
        updated_at: now,
        // restaurant, restaurant_id will be added below if defined
    };
    // Now add optional fields ONLY if they are valid non-empty strings.
    const clean = { ...base };
    if (typeof input.restaurant === "string" &&
        input.restaurant.trim() !== "") {
        clean.restaurant = input.restaurant.trim();
    }
    if (typeof input.restaurant_id === "string" &&
        input.restaurant_id.trim() !== "") {
        clean.restaurant_id = input.restaurant_id.trim();
    }
    // finally write to Firestore
    await col().doc(id).set(clean);
    return { ok: true, id };
}
/**
 * User came back and said "I placed it".
 *
 * We:
 *  - verify caller owns this event (uid match)
 *  - mark the order event as completed (idempotent)
 *  - on FIRST completion ONLY:
 *      * bump user's total_savings / total_orders
 *      * bump weekly leaderboard score
 *      * award achievements
 *
 * SECURITY:
 *  - Only the same uid who created the order can complete it.
 *
 * ABUSE PROTECTION:
 *  - If already completed, we DO NOT increment again.
 */
async function markCompletion(uid, id, saved_amount) {
    const db = (0, firestore_1.getFirestore)();
    const now = new Date().toISOString();
    const ref = col().doc(id);
    let justCompleted = false; // did we mark it complete in THIS call?
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw new Error("order event not found");
        }
        const curr = snap.data();
        // 🔐 ownership check
        if (curr.user_id !== uid) {
            throw new Error("forbidden");
        }
        // already completed before? then do NOTHING (anti-abuse)
        if (curr.completed_at) {
            return;
        }
        // first-time completion
        justCompleted = true;
        tx.update(ref, {
            outcome: "saved",
            saved_amount,
            completed_at: now,
            updated_at: now,
        });
    });
    // if it was already completed before, we stop here → no double farming
    if (!justCompleted) {
        return { ok: true };
    }
    // We need the event again to know user_id (uid we already have)
    // and final saved_amount that we just wrote.
    const freshSnap = await col().doc(id).get();
    const freshDoc = freshSnap.data();
    if (!freshDoc) {
        // extremely unlikely race; bail safely
        return { ok: true };
    }
    const finalSaved = Number(freshDoc.saved_amount || saved_amount || 0);
    // roll up totals on /users/{uid}
    await db
        .collection("users")
        .doc(uid)
        .set({
        total_savings: firestore_1.FieldValue.increment(finalSaved),
        total_orders: firestore_1.FieldValue.increment(1),
        updated_at: now,
    }, { merge: true });
    // weekly leaderboard bump
    await (0, leaderboard_1.bumpScore)(uid, finalSaved);
    // basic achievements
    await (0, achievements_1.ensureAchievement)(uid, "first_save", "First Saver", 10);
    const total = await totalSavedFor(uid);
    if (total >= 100) {
        await (0, achievements_1.ensureAchievement)(uid, "hundred_club", "₹100 Club", 25);
    }
    const count = await completedCountFor(uid);
    if (count >= 3) {
        await (0, achievements_1.ensureAchievement)(uid, "hat_trick", "3 Saves Completed", 15);
    }
    return { ok: true };
}
/**
 * Recent events for user
 */
async function getOrderEvents(user_id) {
    const snap = await col()
        .where("user_id", "==", user_id)
        .orderBy("created_at", "desc")
        .limit(20)
        .get();
    const data = snap.docs.map((d) => d.data());
    return { ok: true, data };
}
// --------- helpers ---------
async function totalSavedFor(user_id) {
    const snap = await col().where("user_id", "==", user_id).get();
    return snap.docs.reduce((sum, d) => {
        const row = d.data();
        return sum + (row.saved_amount || 0);
    }, 0);
}
async function completedCountFor(user_id) {
    const snap = await col()
        .where("user_id", "==", user_id)
        .where("outcome", "==", "saved")
        .get();
    return snap.size;
}
router.post("/outbound", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid) {
            status = 401;
            return res.status(401).json({ ok: false, error: "unauthorized" });
        }
        const result = await markOutbound(req.body, uid);
        return res.json(result);
    }
    catch (err) {
        const taggedStatus = err?.name === "ZodError" ? 400 : 500;
        status = taggedStatus;
        log.error({ err }, "POST /orders/outbound failed");
        return res.status(taggedStatus).json({ ok: false, error: err?.message || "internal error" });
    }
    finally {
        (0, metrics_1.observeApi)("orders_outbound", "POST", status, timer);
    }
});
router.post("/complete", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid) {
            status = 401;
            return res.status(401).json({ ok: false, error: "unauthorized" });
        }
        const id = String(req.body?.id || "").trim();
        const saved = Number(req.body?.saved_amount ?? req.body?.saved);
        if (!id) {
            status = 400;
            return res.status(400).json({ ok: false, error: "id required" });
        }
        await markCompletion(uid, id, Number.isFinite(saved) ? saved : 0);
        return res.json({ ok: true });
    }
    catch (err) {
        const msg = err?.message || "internal error";
        const tagged = msg === "forbidden" ? 403 : msg === "order event not found" ? 404 : err?.name === "ZodError" ? 400 : 500;
        status = tagged;
        log.error({ err }, "POST /orders/complete failed");
        return res.status(tagged).json({ ok: false, error: msg });
    }
    finally {
        (0, metrics_1.observeApi)("orders_complete", "POST", status, timer);
    }
});
router.get("/", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid) {
            status = 401;
            return res.status(401).json({ ok: false, error: "unauthorized" });
        }
        const result = await getOrderEvents(uid);
        res.json(result);
    }
    catch (err) {
        status = 500;
        log.error({ err }, "GET /orders failed");
        res.status(500).json({ ok: false, error: "internal error" });
    }
    finally {
        (0, metrics_1.observeApi)("orders_history", "GET", status, timer);
    }
});
exports.default = router;

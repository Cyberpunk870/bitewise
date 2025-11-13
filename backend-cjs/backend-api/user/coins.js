"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCoins = addCoins;
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const AddCoinsInput = zod_1.z.object({
    uid: zod_1.z.string().min(1),
    amount: zod_1.z.number().int().min(1),
    reason: zod_1.z.string().min(1), // e.g., "order_savings", "task_complete", "achievement"
    meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(), // flexible payload for auditing
    request_id: zod_1.z.string().optional(), // optional dedupe key
});
async function addCoins(raw) {
    const parsed = AddCoinsInput.parse(raw);
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.collection("users").doc(parsed.uid);
    const coinsRef = db
        .collection("coins_history")
        .doc(parsed.request_id || db.collection("_tmp").doc().id);
    const now = new Date().toISOString();
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
    return { ok: true, new_total, txn_id: coinsRef.id };
}

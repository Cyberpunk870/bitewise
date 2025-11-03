// bitewise/server/api/user/coins.ts
import { z } from "zod";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const AddCoinsInput = z.object({
  uid: z.string().min(1),
  amount: z.number().int().min(1),
  reason: z.string().min(1), // e.g., "order_savings", "task_complete", "achievement"
  meta: z.record(z.any()).optional(), // flexible payload for auditing
  request_id: z.string().optional(), // optional dedupe key
});

export async function addCoins(raw: unknown): Promise<{ ok: true; new_total: number; txn_id: string }> {
  const parsed = AddCoinsInput.parse(raw);
  const db = getFirestore();
  const userRef = db.collection("users").doc(parsed.uid);
  const coinsRef = db.collection("coins_history").doc(parsed.request_id || db.collection("_tmp").doc().id);

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

    tx.set(
      userRef,
      {
        total_coins: FieldValue.increment(parsed.amount),
        updated_at: now,
      },
      { merge: true }
    );
  });

  const newSnap = await userRef.get();
  const new_total = newSnap.exists ? Number(newSnap.data()?.total_coins || 0) : 0;

  return { ok: true, new_total, txn_id: coinsRef.id };
}
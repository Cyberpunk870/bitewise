// bitewise/backend-lib/backend-api/orders.ts
import { z } from "zod";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { bumpScore } from "./leaderboard";
import { ensureAchievement } from "./achievements";
import express from "express";
import logger from "../lib/logger";
import { metricsTimer, observeApi } from "../lib/metrics";

const log = logger.child({ module: "orders" });

/**
 * We accept a flexible payload because frontend can evolve.
 * We normalize it here before writing Firestore.
 */
const router = express.Router();
const Inbound = z.object({
  platform: z.string().optional(),
  partner: z.string().optional(),        // legacy alias
  restaurant: z.string().optional(),
  restaurant_id: z.string().optional(),
  dish_name: z.string().optional(),      // "Paneer Tikka Roll", or basket name

  compare_price: z.number().min(0).optional(),   // other platform total
  platform_price: z.number().min(0).optional(),  // chosen platform total

  total: z.number().min(0).optional(),           // chosen platform total (new field from Compare.tsx)
  otherTotal: z.number().min(0).optional(),      // the other platform's total
  delta: z.number().optional(),                  // savings = otherTotal - total

  saved_amount: z.number().min(0).optional(),    // we'll compute if missing

  outcome: z.enum(["saved", "missed", "viewed"]).optional(),
  redirected_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type OrderEventDoc = {
  id: string;
  user_id: string;
  platform: string;
  restaurant?: string;
  restaurant_id?: string;
  dish_name: string;
  compare_price: number;    // what the "other" platform would've charged
  platform_price: number;   // what the chosen platform charges
  saved_amount: number;     // compare_price - platform_price (floor at 0)
  outcome: "saved" | "missed" | "viewed";
  redirected_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
};

function col() {
  return getFirestore().collection("order_events");
}

/**
 * User tapped "Order on Swiggy" / "Order on Zomato".
 * We log intent + pricing snapshot.
 */
export async function markOutbound(raw: unknown, uid: string) {
  const input = Inbound.parse(raw);

  // normalize platform field
  const platform = input.platform ?? input.partner ?? "unknown";

  // --- money math / savings math (keep your logic) ---
  // saved_amount: prefer explicit. Otherwise derive from delta or totals.
  let saved_amount = input.saved_amount ?? 0;
  if (!Number.isFinite(saved_amount)) saved_amount = 0;

  if (saved_amount === 0) {
    if (typeof (input as any).delta === "number") {
      // frontend sometimes sends delta = otherTotal - total
      saved_amount = Math.max(0, (input as any).delta);
    } else if (
      typeof (input as any).otherTotal === "number" &&
      typeof (input as any).total === "number"
    ) {
      saved_amount = Math.max(
        0,
        (input as any).otherTotal - (input as any).total
      );
    }
  }

  // compare_price: what the "other" platform would've cost
  const compare_price =
    typeof (input as any).otherTotal === "number"
      ? (input as any).otherTotal
      : typeof input.compare_price === "number"
      ? input.compare_price
      : 0;

  // platform_price: what we're actually paying on chosen platform
  const platform_price =
    typeof (input as any).total === "number"
      ? (input as any).total
      : typeof input.platform_price === "number"
      ? input.platform_price
      : 0;

  // --- timestamps / id ---
  const now = new Date().toISOString();
  const id = randomUUID();

  // Build a base doc with only required / always-safe fields.
  const base: OrderEventDoc = {
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
  } as OrderEventDoc;

  // Now add optional fields ONLY if they are valid non-empty strings.
  const clean: any = { ...base };
  if (
    typeof (input as any).restaurant === "string" &&
    (input as any).restaurant.trim() !== ""
  ) {
    clean.restaurant = (input as any).restaurant.trim();
  }
  if (
    typeof (input as any).restaurant_id === "string" &&
    (input as any).restaurant_id.trim() !== ""
  ) {
    clean.restaurant_id = (input as any).restaurant_id.trim();
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
export async function markCompletion(
  uid: string,
  id: string,
  saved_amount: number
) {
  const db = getFirestore();
  const now = new Date().toISOString();
  const ref = col().doc(id);

  let justCompleted = false; // did we mark it complete in THIS call?

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error("order event not found");
    }

    const curr = snap.data() as OrderEventDoc;

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
  const freshDoc = freshSnap.data() as OrderEventDoc | undefined;
  if (!freshDoc) {
    // extremely unlikely race; bail safely
    return { ok: true };
  }

  const finalSaved = Number(freshDoc.saved_amount || saved_amount || 0);

  // roll up totals on /users/{uid}
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        total_savings: FieldValue.increment(finalSaved),
        total_orders: FieldValue.increment(1),
        updated_at: now,
      },
      { merge: true }
    );

  // weekly leaderboard bump
  await bumpScore(uid, finalSaved);

  // basic achievements
  await ensureAchievement(uid, "first_save", "First Saver", 10);

  const total = await totalSavedFor(uid);
  if (total >= 100) {
    await ensureAchievement(uid, "hundred_club", "₹100 Club", 25);
  }
  const count = await completedCountFor(uid);
  if (count >= 3) {
    await ensureAchievement(uid, "hat_trick", "3 Saves Completed", 15);
  }

  return { ok: true };
}

/**
 * Recent events for user
 */
export async function getOrderEvents(user_id: string) {
  const snap = await col()
    .where("user_id", "==", user_id)
    .orderBy("created_at", "desc")
    .limit(20)
    .get();

  const data = snap.docs.map((d) => d.data() as OrderEventDoc);
  return { ok: true, data };
}

// --------- helpers ---------
async function totalSavedFor(user_id: string) {
  const snap = await col().where("user_id", "==", user_id).get();
  return snap.docs.reduce((sum, d) => {
    const row = d.data() as OrderEventDoc;
    return sum + (row.saved_amount || 0);
  }, 0);
}

async function completedCountFor(user_id: string) {
  const snap = await col()
    .where("user_id", "==", user_id)
    .where("outcome", "==", "saved")
    .get();
  return snap.size;
}

router.post("/outbound", async (req: any, res) => {
  const timer = metricsTimer();
  let status = 200;
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) {
      status = 401;
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const result = await markOutbound(req.body, uid);
    return res.json(result);
  } catch (err: any) {
    const taggedStatus = err?.name === "ZodError" ? 400 : 500;
    status = taggedStatus;
    log.error({ err }, "POST /orders/outbound failed");
    return res.status(taggedStatus).json({ ok: false, error: err?.message || "internal error" });
  } finally {
    observeApi("orders_outbound", "POST", status, timer);
  }
});

router.post("/complete", async (req: any, res) => {
  const timer = metricsTimer();
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
  } catch (err: any) {
    const msg = err?.message || "internal error";
    const tagged =
      msg === "forbidden" ? 403 : msg === "order event not found" ? 404 : err?.name === "ZodError" ? 400 : 500;
    status = tagged;
    log.error({ err }, "POST /orders/complete failed");
    return res.status(tagged).json({ ok: false, error: msg });
  } finally {
    observeApi("orders_complete", "POST", status, timer);
  }
});

router.get("/", async (req: any, res) => {
  const timer = metricsTimer();
  let status = 200;
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) {
      status = 401;
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const result = await getOrderEvents(uid);
    res.json(result);
  } catch (err: any) {
    status = 500;
    log.error({ err }, "GET /orders failed");
    res.status(500).json({ ok: false, error: "internal error" });
  } finally {
    observeApi("orders_history", "GET", status, timer);
  }
});
export default router;

// backend-lib/backend-api/user/profile.ts

import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import logger from "../../lib/logger";

const log = logger.child({ module: "user-profile" });

const router = Router();

/** Lightweight shape for achievements in profile panel. */
type AchievementLite = {
  id: string;
  code: string;
  points: number;
  earned_at: string;
};

export type ProfileOut = {
  uid: string;
  name?: string;
  phone?: string;
  total_savings: number;
  total_coins: number;
  achievements: AchievementLite[];
  rank: number | null;
};

/** GET /backend-api/user/profile — current user's profile */
router.get("/", async (req: any, res) => {
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const result = await getUserProfile(uid);
    return res.json(result);
  } catch (e: any) {
    log.error({ err: e }, "GET /profile failed");
    return res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /backend-api/user/profile — update name/phone */
router.post("/", async (req: any, res) => {
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const input = req.body;
    const result = await upsertBasicProfile(uid, input);
    return res.json(result);
  } catch (e: any) {
    log.error({ err: e }, "POST /profile failed");
    const status = typeof e?.status === "number" ? e.status : 500;
    return res.status(status).json({ ok: false, error: e?.message || "internal error" });
  }
});

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */
/* -------------------------------------------------------------------------- */

export async function getUserProfile(uid: string): Promise<{ ok: true; profile: ProfileOut }> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const firstSnap = await userRef.get();

  if (!firstSnap.exists) {
    const now = new Date().toISOString();
    await userRef.set(
      {
        total_savings: 0,
        total_coins: 0,
        total_orders: 0,
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );
  }

  const userSnap = await userRef.get();
  const user = userSnap.data() || {};
  const total_savings = Number(user.total_savings || 0);
  const total_coins = Number(user.total_coins || 0);
  const name = user.name ? String(user.name) : undefined;
  const phone = user.phone ? String(user.phone) : undefined;

  let achievements: AchievementLite[] = [];
  try {
    const achSnap = await db
      .collection("achievements")
      .where("user_id", "==", uid)
      .orderBy("earned_at", "desc")
      .limit(20)
      .get();

    achievements = achSnap.docs.map((d) => {
      const a = d.data() as any;
      return {
        id: a.id ?? d.id,
        code: String(a.code || ""),
        points: Number(a.points || 0),
        earned_at: String(a.earned_at || a.created_at || ""),
      };
    });
  } catch (err) {
    log.warn({ err }, "achievements query failed");
  }

  let rank: number | null = null;
  try {
    const weekId = currentWeekId();
    const lbSnap = await db
      .collection("leaderboard")
      .where("week_id", "==", weekId)
      .where("region", "==", "global")
      .orderBy("score", "desc")
      .limit(100)
      .get();

    lbSnap.docs.some((doc, idx) => {
      const row = doc.data() as any;
      if (row.user_id === uid) {
        rank = idx + 1;
        return true;
      }
      return false;
    });
  } catch (err) {
    log.warn({ err }, "leaderboard query failed");
  }

  return {
    ok: true,
    profile: {
      uid,
      name,
      phone,
      total_savings,
      total_coins,
      achievements,
      rank,
    },
  };
}

export async function upsertBasicProfile(
  uid: string,
  input: { name?: string; phone?: string }
) {
  const db = getFirestore();
  const now = new Date().toISOString();
  const update: Record<string, any> = { updated_at: now };

  if (input.name?.trim()) {
    update.name = input.name.trim();
  }

  if (input.phone?.trim()) {
    const nextPhone = input.phone.trim();
    await ensureUniquePhone(uid, nextPhone);
    update.phone = nextPhone;
  }

  await db.collection("users").doc(uid).set(update, { merge: true });
  return { ok: true };
}

async function ensureUniquePhone(uid: string, phone: string) {
  const db = getFirestore();
  const snap = await db
    .collection("users")
    .where("phone", "==", phone)
    .limit(1)
    .get();
  if (!snap.empty) {
    const existingId = snap.docs[0].id;
    if (existingId !== uid) {
      const err: any = new Error("An account with this phone already exists.");
      err.status = 409;
      throw err;
    }
  }
}

function currentWeekId(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*                               Default Export                               */
/* -------------------------------------------------------------------------- */

// ✅ Ensure default export is at the very bottom and only once
export default router;

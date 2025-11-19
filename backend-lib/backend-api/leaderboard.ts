// bitewise/server/api/leaderboard.ts
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import express from "express";
import logger from "../lib/logger";

const log = logger.child({ module: "leaderboard" });

const router = express.Router();

export type LeaderboardRow = {
  id: string;        // user_id + week_id + region
  user_id: string;
  week_id: string;   // e.g., "2025-W42"
  region: string;    // e.g., "IN-DELHI" or "global"
  score: number;     // total saved_amount for that period
  updated_at: string;
};

function col() {
  return getFirestore().collection("leaderboard");
}

export function weekIdFrom(date = new Date()) {
  // ISO week
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Upsert user's score for a week+region. */
export async function bumpScore(user_id: string, delta: number, week_id?: string, region = "global") {
  if (!Number.isFinite(delta) || delta === 0) return { ok: true };
  const db = getFirestore();
  const wk = week_id ?? weekIdFrom();
  const id = `${user_id}__${wk}__${region}`;
  const now = new Date().toISOString();

  await db.collection("leaderboard").doc(id).set(
    {
      id,
      user_id,
      week_id: wk,
      region,
      score: FieldValue.increment(delta),
      updated_at: now,
    },
    { merge: true }
  );

  return { ok: true, id };
}

/** Return leaderboard for a week + region (default current week, global). */
export async function getLeaderboard(opts?: { week_id?: string; region?: string; limit?: number }) {
  const wk = opts?.week_id ?? weekIdFrom();
  const region = opts?.region ?? "global";
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);

  const snap = await col()
    .where("week_id", "==", wk)
    .where("region", "==", region)
    .orderBy("score", "desc")
    .limit(limit)
    .get();

  const data = snap.docs.map((d) => d.data() as LeaderboardRow);
  return { ok: true, week_id: wk, region, data };
}

router.get("/", async (req, res) => {
  try {
    const { week_id, region, limit } = req.query;
    const parsedLimit = typeof limit === "string" ? Number(limit) : undefined;
    const result = await getLeaderboard({
      week_id: typeof week_id === "string" && week_id.trim() ? week_id.trim() : undefined,
      region: typeof region === "string" && region.trim() ? region.trim() : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    res.json(result);
  } catch (err: any) {
    log.error({ err }, "GET /leaderboard failed");
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});
export default router;

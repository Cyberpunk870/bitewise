// bitewise/server/api/achievements.ts
import { z } from "zod";
import { getFirestore } from "firebase-admin/firestore";

const AchInput = z.object({
  user_id: z.string().min(1),
  code: z.string().min(1),        // e.g., "first_save", "hundred_club"
  title: z.string().min(1),       // human-readable
  points: z.number().min(0).default(0),
  earned_at: z.string().optional() // ISO; server will set if absent
});

export type AchievementDoc = z.infer<typeof AchInput> & {
  id: string;
  created_at: string;
  updated_at: string;
};

function col() {
  return getFirestore().collection("achievements");
}

/**
 * List user achievements, newest first.
 */
export async function getAchievementsFor(user_id: string) {
  const snap = await col()
    .where("user_id", "==", user_id)
    .orderBy("earned_at", "desc")
    .limit(50)
    .get();

  return snap.docs.map((d) => d.data() as AchievementDoc);
}

/**
 * Idempotent award by (user_id + code).
 * Safe to call multiple times.
 */
export async function awardAchievement(raw: unknown) {
  const parsed = AchInput.parse(raw);
  const db = getFirestore();

  const now = new Date().toISOString();
  const id = `${parsed.user_id}__${parsed.code}`;
  const ref = col().doc(id);

  const snap = await ref.get();
  const existing = snap.exists ? (snap.data() as AchievementDoc) : undefined;

  const earnedAt = existing?.earned_at || parsed.earned_at || now;

  const doc: AchievementDoc = {
    id,
    user_id: parsed.user_id,
    code: parsed.code,
    title: parsed.title,
    points: parsed.points ?? 0,
    earned_at: earnedAt,
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  await ref.set(doc, { merge: true });

  return { ok: true, id };
}

/**
 * Convenience used by orders flow.
 * Still idempotent.
 */
export async function ensureAchievement(
  user_id: string,
  code: string,
  title: string,
  points = 0
) {
  return awardAchievement({ user_id, code, title, points });
}

/**
 * Exported for GET /api/achievements in index.ts.
 * We now scope it to the authed user instead of returning [].
 */
export async function getAchievements(uid?: string) {
  if (!uid) {
    return { ok: true, data: [] as AchievementDoc[] };
  }
  const data = await getAchievementsFor(uid);
  return { ok: true, data };
}

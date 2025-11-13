"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAchievementsFor = getAchievementsFor;
exports.awardAchievement = awardAchievement;
exports.ensureAchievement = ensureAchievement;
exports.getAchievements = getAchievements;
// bitewise/server/api/achievements.ts
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const AchInput = zod_1.z.object({
    user_id: zod_1.z.string().min(1),
    code: zod_1.z.string().min(1), // e.g., "first_save", "hundred_club"
    title: zod_1.z.string().min(1), // human-readable
    points: zod_1.z.number().min(0).default(0),
    earned_at: zod_1.z.string().optional() // ISO; server will set if absent
});
function col() {
    return (0, firestore_1.getFirestore)().collection("achievements");
}
/**
 * List user achievements, newest first.
 */
async function getAchievementsFor(user_id) {
    const snap = await col()
        .where("user_id", "==", user_id)
        .orderBy("earned_at", "desc")
        .limit(50)
        .get();
    return snap.docs.map((d) => d.data());
}
/**
 * Idempotent award by (user_id + code).
 * Safe to call multiple times.
 */
async function awardAchievement(raw) {
    const parsed = AchInput.parse(raw);
    const db = (0, firestore_1.getFirestore)();
    const now = new Date().toISOString();
    const id = `${parsed.user_id}__${parsed.code}`;
    const ref = col().doc(id);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : undefined;
    const earnedAt = existing?.earned_at || parsed.earned_at || now;
    const doc = {
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
async function ensureAchievement(user_id, code, title, points = 0) {
    return awardAchievement({ user_id, code, title, points });
}
/**
 * Exported for GET /api/achievements in index.ts.
 * We now scope it to the authed user instead of returning [].
 */
async function getAchievements(uid) {
    if (!uid) {
        return { ok: true, data: [] };
    }
    const data = await getAchievementsFor(uid);
    return { ok: true, data };
}
exports.default = router;

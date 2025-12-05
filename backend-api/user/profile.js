"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProfile = getUserProfile;
exports.upsertBasicProfile = upsertBasicProfile;
const firestore_1 = require("firebase-admin/firestore");
/**
 * Produce the current user's dashboard profile.
 * - Ensures /users/{uid} doc exists (so totals never show undefined)
 * - Pulls last ~20 achievements
 * - Computes current weekly rank by scanning leaderboard
 */
async function getUserProfile(uid) {
    const db = (0, firestore_1.getFirestore)();
    // Ensure user doc exists
    const userRef = db.collection("users").doc(uid);
    const firstSnap = await userRef.get();
    if (!firstSnap.exists) {
        const now = new Date().toISOString();
        await userRef.set({
            total_savings: 0,
            total_coins: 0,
            total_orders: 0,
            created_at: now,
            updated_at: now,
        }, { merge: true });
    }
    const userSnap = await userRef.get();
    const user = userSnap.data() || {};
    const total_savings = Number(user.total_savings || 0);
    const total_coins = Number(user.total_coins || 0);
    const name = user.name ? String(user.name) : undefined;
    const phone = user.phone ? String(user.phone) : undefined;
    // Achievements (latest 20)
    const achSnap = await db
        .collection("achievements")
        .where("user_id", "==", uid)
        .orderBy("earned_at", "desc")
        .limit(20)
        .get();
    const achievements = achSnap.docs.map((d) => {
        const a = d.data();
        return {
            id: a.id ?? d.id,
            code: String(a.code || ""),
            points: Number(a.points || 0),
            earned_at: String(a.earned_at || a.created_at || ""),
        };
    });
    // Leaderboard rank this week (global pool).
    const weekId = currentWeekId();
    const lbSnap = await db
        .collection("leaderboard")
        .where("week_id", "==", weekId)
        .where("region", "==", "global")
        .orderBy("score", "desc")
        .limit(100)
        .get();
    let rank = null;
    lbSnap.docs.some((doc, idx) => {
        const row = doc.data();
        if (row.user_id === uid) {
            rank = idx + 1;
            return true;
        }
        return false;
    });
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
/**
 * Upsert name/phone (no overwrite with empty values).
 */
async function upsertBasicProfile(uid, input) {
    const db = (0, firestore_1.getFirestore)();
    const now = new Date().toISOString();
    const update = { updated_at: now };
    if (input.name && input.name.trim()) {
        update.name = input.name.trim();
    }
    if (input.phone && input.phone.trim()) {
        update.phone = input.phone.trim();
    }
    await db.collection("users").doc(uid).set(update, { merge: true });
    return { ok: true };
}
/**
 * Stable, index-friendly key like 2025-W42
 */
function currentWeekId() {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
    const week = Math.ceil((days + jan1.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

"use strict";
// backend-lib/backend-api/analytics.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const router = (0, express_1.Router)();
router.get("/summary", async (req, res) => {
    try {
        const daysRaw = Number(req.query?.days);
        const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(1, daysRaw)) : 7;
        const since = Date.now() - days * 24 * 60 * 60 * 1000;
        const db = (0, firestore_1.getFirestore)();
        const snap = await db
            .collection("analytics_events")
            .where("ts", ">=", since)
            .orderBy("ts", "desc")
            .limit(5000)
            .get();
        const totals = {};
        const timelineMap = {};
        snap.forEach((doc) => {
            const data = doc.data();
            const name = String(data?.name || "unknown");
            totals[name] = (totals[name] || 0) + 1;
            const ts = Number(data?.ts) || Date.now();
            const dateKey = new Date(ts).toISOString().slice(0, 10);
            timelineMap[dateKey] = (timelineMap[dateKey] || 0) + 1;
        });
        const timeline = Object.entries(timelineMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, total]) => ({ date, total }));
        res.json({
            ok: true,
            range: { days, since, until: Date.now() },
            totals,
            timeline,
            sample: snap.size,
        });
    }
    catch (err) {
        console.error("GET /analytics/summary failed", err);
        res.status(500).json({ ok: false, error: "internal error" });
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebaseAdmin_1 = require("../lib/firebaseAdmin");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const router = (0, express_1.Router)();
// Basic shared-secret auth (dashboard env: MENU_INGEST_SECRET)
function checkAuth(req) {
    const secret = process.env.MENU_INGEST_SECRET || "";
    if (!secret)
        return false;
    const provided = req.headers["x-bitewise-menu-secret"] ||
        (typeof req.body?.secret === "string" ? req.body.secret : "");
    return provided === secret;
}
router.post("/", async (req, res) => {
    try {
        if (!checkAuth(req)) {
            return res.status(403).json({ ok: false, error: "forbidden" });
        }
        const payload = req.body;
        if (!payload?.items || !Array.isArray(payload.items)) {
            return res.status(400).json({ ok: false, error: "items[] required" });
        }
        (0, firebaseAdmin_1.ensureAdmin)();
        const db = (0, firestore_1.getFirestore)();
        const msg = (0, messaging_1.getMessaging)();
        const now = Date.now();
        const updates = [];
        const pushes = [];
        for (const snap of payload.items) {
            if (!snap || snap.type !== "menu_snapshot")
                continue;
            const r = snap.restaurant || {};
            const rid = String(r.restaurant_id || "").trim();
            if (!rid)
                continue;
            const docRef = db.collection("menu_snapshots").doc(rid);
            const prev = await docRef.get();
            const prevData = prev.exists ? prev.data() : null;
            updates.push({
                ref: docRef,
                data: {
                    platform: snap.platform || "unknown",
                    scraped_at: snap.scraped_at || now,
                    restaurant: {
                        id: rid,
                        name: r.restaurant_name || "",
                        rating: r.rating ?? null,
                        rating_count: r.rating_count ?? null,
                        delivery_sla: r.delivery_sla ?? null,
                        lat: r.lat ?? null,
                        lng: r.lng ?? null,
                        city: r.city ?? null,
                        locality: r.locality ?? r.areaName ?? null,
                        image: r.image ?? null,
                    },
                    items: (snap.items || []).map((it) => ({
                        id: String(it.menu_id),
                        name: it.name || "",
                        price: typeof it.price === "number" ? it.price : null,
                        mrp: typeof it.mrp === "number" ? it.mrp : null,
                        isVeg: it.isVeg ?? null,
                        image: it.image ?? null,
                        offers: Array.isArray(it.offers) ? it.offers : [],
                    })),
                    fees: snap.fees || {},
                    updated_at: now,
                },
            });
            // Push hook: notify on meaningful price drops
            if (prevData && Array.isArray(prevData.items)) {
                const prevIndex = new Map();
                prevData.items.forEach((p) => prevIndex.set(String(p.id), p));
                const drops = [];
                for (const it of snap.items || []) {
                    const prevItem = prevIndex.get(String(it.menu_id));
                    const oldPrice = typeof prevItem?.price === "number" ? prevItem.price : null;
                    const newPrice = typeof it.price === "number" ? it.price : null;
                    if (oldPrice != null && newPrice != null && newPrice < oldPrice) {
                        drops.push({ name: it.name || "Dish", old: oldPrice, now: newPrice });
                    }
                }
                if (drops.length) {
                    pushes.push({
                        restaurant: r.restaurant_name || "Restaurant",
                        drops,
                    });
                }
            }
        }
        // Commit writes
        if (updates.length) {
            const batch = db.batch();
            updates.forEach((u) => batch.set(u.ref, u.data, { merge: true }));
            await batch.commit();
        }
        // Send push notifications (best-effort)
        if (pushes.length && process.env.VAPID_PUBLIC_KEY) {
            for (const p of pushes) {
                try {
                    await msg.send({
                        topic: "price-drops",
                        data: {
                            type: "price_drop",
                            restaurant: p.restaurant,
                            drops: JSON.stringify(p.drops.slice(0, 3)),
                        },
                        notification: {
                            title: `Price drop at ${p.restaurant}`,
                            body: `${p.drops[0].name} dropped to ₹${p.drops[0].now}`,
                        },
                    });
                }
                catch {
                    /* ignore push failures */
                }
            }
        }
        return res.json({ ok: true, updated: updates.length, pushes: pushes.length });
    }
    catch (err) {
        return res.status(500).json({ ok: false, error: err?.message || "ingest failed" });
    }
});
exports.default = router;

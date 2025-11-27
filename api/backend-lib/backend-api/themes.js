"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminThemesRouter = void 0;
// backend-lib/backend-api/themes.ts
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const firebaseAdmin_1 = require("../lib/firebaseAdmin");
const COLLECTION = "seasonal_themes";
const router = (0, express_1.Router)();
exports.adminThemesRouter = (0, express_1.Router)();
function isActive(theme, now = new Date()) {
    const today = now.toISOString().slice(0, 10);
    const enabled = theme.enabled !== false;
    return enabled && theme.start <= today && today <= theme.end;
}
// --- Public: list active themes ---
router.get("/", async (_req, res) => {
    try {
        const db = (0, firestore_1.getFirestore)();
        const snap = await db.collection(COLLECTION).where("enabled", "==", true).get();
        const now = new Date();
        const themes = [];
        snap.forEach((doc) => themes.push({ id: doc.id, ...doc.data() }));
        const active = themes.filter((t) => isActive(t, now));
        active.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        res.json({ ok: true, themes: active });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
// --- Public: track impression/click ---
router.post("/track", async (req, res) => {
    try {
        const name = String(req.body?.name || "").slice(0, 80);
        const event = String(req.body?.event || "impression");
        if (!name)
            return res.status(400).json({ ok: false, error: "name required" });
        const db = (0, firestore_1.getFirestore)();
        const uid = req.user?.uid || null;
        await db.collection("analytics_events").add({
            name: `theme_${event}`,
            ts: Date.now(),
            uid,
            meta: { theme: name },
        });
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: "internal error" });
    }
});
// --- Admin: list all themes ---
exports.adminThemesRouter.get("/list", async (_req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const db = (0, firestore_1.getFirestore)();
        const snap = await db.collection(COLLECTION).get();
        const themes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json({ ok: true, themes });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
// --- Admin: upsert a theme ---
exports.adminThemesRouter.post("/upsert", async (req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const theme = req.body;
        if (!theme?.name || !theme?.start || !theme?.end || !theme?.gradient || !theme?.accent || !theme?.heroTitle || !theme?.heroSubtitle) {
            return res.status(400).json({ ok: false, error: "missing required fields" });
        }
        const db = (0, firestore_1.getFirestore)();
        const id = theme.id || theme.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
        await db.collection(COLLECTION).doc(id).set({
            ...theme,
            enabled: theme.enabled !== false,
            updated_at: new Date().toISOString(),
        }, { merge: true });
        res.json({ ok: true, id });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
// --- Admin: delete ---
exports.adminThemesRouter.post("/delete", async (req, res) => {
    try {
        (0, firebaseAdmin_1.ensureAdmin)();
        const id = String(req.body?.id || "");
        if (!id)
            return res.status(400).json({ ok: false, error: "id required" });
        const db = (0, firestore_1.getFirestore)();
        await db.collection(COLLECTION).doc(id).delete();
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
exports.default = router;

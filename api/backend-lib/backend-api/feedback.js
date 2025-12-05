"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = __importDefault(require("../lib/logger"));
const log = logger_1.default.child({ module: "feedback" });
const router = (0, express_1.Router)();
function clean(input) {
    if (!input)
        return null;
    const str = String(input).trim();
    return str ? str : null;
}
router.post("/", async (req, res) => {
    const uid = req.user?.uid || req.uid;
    if (!uid)
        return res.status(401).json({ ok: false, error: "unauthorized" });
    try {
        const message = clean(req.body?.message);
        if (!message)
            return res.status(400).json({ ok: false, error: "message required" });
        const db = (0, firestore_1.getFirestore)();
        let phone = null;
        let name = null;
        try {
            const snap = await db.collection("users").doc(uid).get();
            const data = snap.data() || {};
            phone = clean(data.phone);
            name = clean(data.name);
        }
        catch (err) {
            log.warn({ err, uid }, "could not fetch user profile for feedback");
        }
        const now = new Date().toISOString();
        const doc = await db.collection("feedback").add({
            uid,
            phone,
            name,
            message,
            steps: clean(req.body?.steps),
            category: clean(req.body?.category) || "general",
            screen: clean(req.body?.screen),
            severity: clean(req.body?.severity) || "medium",
            device_info: clean(req.body?.deviceInfo),
            created_at: now,
            status: "open",
        });
        return res.json({ ok: true, id: doc.id });
    }
    catch (err) {
        log.error({ err, uid }, "feedback submission failed");
        return res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
exports.default = router;

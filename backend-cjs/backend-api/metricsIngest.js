"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Lightweight metrics ingest (unauthenticated, but minimal fields) to capture client beacons.
const express_1 = __importDefault(require("express"));
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = __importDefault(require("../lib/logger"));
const log = logger_1.default.child({ module: "metrics-ingest" });
const router = express_1.default.Router();
router.post("/", async (req, res) => {
    try {
        const body = req.body;
        const items = Array.isArray(body) ? body : [body];
        const db = (0, firestore_1.getFirestore)();
        const batch = db.batch();
        items.forEach((it) => {
            if (!it?.event)
                return;
            const doc = db.collection("client_metrics").doc();
            batch.set(doc, {
                id: doc.id,
                event: String(it.event),
                screen: it.screen || null,
                ms: typeof it.ms === "number" ? it.ms : null,
                message: it.message || null,
                ts: Date.now(),
                created_at: new Date().toISOString(),
                // optional: user-agent/IP for debugging
                ua: req.headers["user-agent"] || null,
            });
        });
        await batch.commit();
        res.json({ ok: true, count: items.length });
    }
    catch (err) {
        log.error({ err }, "metrics ingest failed");
        res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
});
exports.default = router;

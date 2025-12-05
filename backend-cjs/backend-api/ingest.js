"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../lib/logger"));
const log = logger_1.default.child({ module: "ingest" });
const router = express_1.default.Router();
const EventSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(64),
    ts: zod_1.z.number().int().optional(),
    props: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
const ingestHandler = async (req, res, next) => {
    try {
        const uid = req.user?.uid || req.uid || null;
        const events = Array.isArray(req.body?.events) ? req.body.events : [];
        if (!events.length)
            return res.status(400).json({ ok: false, error: "events required" });
        if (events.length > 50)
            return res.status(400).json({ ok: false, error: "too many events" });
        const parsed = events.map((ev) => EventSchema.parse(ev));
        const db = (0, firestore_1.getFirestore)();
        const batch = db.batch();
        parsed.forEach((ev) => {
            const doc = db.collection("analytics_events").doc();
            batch.set(doc, {
                id: doc.id,
                uid,
                name: ev.name,
                props: ev.props || {},
                ts: ev.ts || Date.now(),
                user_agent: req.headers["user-agent"] || null,
                created_at: new Date().toISOString(),
            });
        });
        await batch.commit();
        res.json({ ok: true, count: parsed.length });
    }
    catch (err) {
        log.error({ err }, "POST /ingest failed");
        const status = err?.name === "ZodError" ? 400 : 500;
        if (status === 500)
            return next(err);
        res.status(status).json({ ok: false, error: err?.message || "internal error" });
    }
};
router.post("/", ingestHandler);
exports.default = router;

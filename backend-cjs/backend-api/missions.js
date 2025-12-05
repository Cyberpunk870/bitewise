"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionStateSchema = exports.MissionTaskSchema = void 0;
exports.missionDoc = missionDoc;
exports.fetchMissionState = fetchMissionState;
exports.saveMissionState = saveMissionState;
// backend-lib/backend-api/missions.ts
const express_1 = require("express");
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = __importDefault(require("../lib/logger"));
const metrics_1 = require("../lib/metrics");
const firebaseAdmin_1 = require("../lib/firebaseAdmin");
const log = logger_1.default.child({ module: "missions" });
const router = (0, express_1.Router)();
exports.MissionTaskSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    kind: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    target: zod_1.z.number().int().nonnegative(),
    reward: zod_1.z.number().int().nonnegative(),
    day: zod_1.z.number().int().nonnegative(),
    progress: zod_1.z.number().int().nonnegative(),
    ready: zod_1.z.boolean(),
    done: zod_1.z.boolean(),
    dueTs: zod_1.z.number().optional().nullable(),
});
exports.MissionStateSchema = zod_1.z.object({
    dayKey: zod_1.z.string().min(1),
    totalCompleted: zod_1.z.number().int().nonnegative(),
    streak: zod_1.z.object({
        current: zod_1.z.number().int().nonnegative(),
        best: zod_1.z.number().int().nonnegative(),
        lastDay: zod_1.z.string().nullable().optional(),
    }),
    tasks: zod_1.z.array(exports.MissionTaskSchema).max(10),
    version: zod_1.z.number().int().nonnegative().optional(),
    updated_at: zod_1.z.string().optional(),
});
function missionDoc(uid) {
    return (0, firestore_1.getFirestore)()
        .collection("users")
        .doc(uid)
        .collection("missions")
        .doc("state");
}
function sanitizeTasks(list) {
    return list.slice(0, 10).map((task) => ({
        id: task.id,
        kind: task.kind,
        title: task.title,
        target: task.target,
        reward: task.reward,
        day: task.day,
        progress: task.progress,
        ready: task.ready,
        done: task.done,
        dueTs: typeof task.dueTs === "number" ? task.dueTs : null,
    }));
}
async function fetchMissionState(uid) {
    const snap = await missionDoc(uid).get();
    if (!snap.exists)
        return null;
    const data = snap.data() || {};
    const parsed = exports.MissionStateSchema.safeParse({
        dayKey: data.dayKey ?? "",
        totalCompleted: data.totalCompleted ?? 0,
        streak: data.streak ?? { current: 0, best: 0, lastDay: null },
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        version: data.version ?? 0,
        updated_at: data.updated_at,
    });
    if (!parsed.success) {
        return null;
    }
    return parsed.data;
}
async function saveMissionState(uid, raw) {
    const normalized = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const input = exports.MissionStateSchema.parse({
        ...normalized,
        version: undefined,
        updated_at: undefined,
    });
    const payload = {
        ...input,
        tasks: sanitizeTasks(input.tasks),
        updated_at: new Date().toISOString(),
        version: Date.now(),
    };
    await missionDoc(uid).set(payload, { merge: true });
    return payload;
}
router.get("/state", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid) {
            status = 401;
            return res.status(401).json({ ok: false, error: "unauthorized" });
        }
        (0, firebaseAdmin_1.ensureAdmin)();
        const state = await Promise.race([
            fetchMissionState(uid),
            new Promise((_r, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        return res.json({ ok: true, state });
    }
    catch (err) {
        status = 500;
        log.error({ err }, "GET /missions/state failed");
        return res
            .status(500)
            .json({ ok: false, error: err?.message || "internal error" });
    }
    finally {
        (0, metrics_1.observeApi)("missions_state_get", "GET", status, timer);
    }
});
router.post("/state", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid) {
            status = 401;
            return res.status(401).json({ ok: false, error: "unauthorized" });
        }
        (0, firebaseAdmin_1.ensureAdmin)();
        const state = await Promise.race([
            saveMissionState(uid, req.body),
            new Promise((_r, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        return res.json({ ok: true, state });
    }
    catch (err) {
        const tagged = err?.name === "ZodError" ? 400 : 500;
        status = tagged;
        log.error({ err }, "POST /missions/state failed");
        return res.status(tagged).json({
            ok: false,
            error: err?.message || "internal error",
        });
    }
    finally {
        (0, metrics_1.observeApi)("missions_state_post", "POST", status, timer);
    }
});
exports.default = router;

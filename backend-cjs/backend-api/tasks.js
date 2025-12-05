"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend-lib/backend-api/tasks.ts
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../lib/logger"));
const missions_1 = require("./missions");
const metrics_1 = require("../lib/metrics");
const router = express_1.default.Router();
const log = logger_1.default.child({ module: "tasks" });
const TaskSyncSchema = zod_1.z.object({
    dayKey: zod_1.z.string().min(1).optional(),
    totalCompleted: zod_1.z.number().int().nonnegative().optional(),
    streak: zod_1.z
        .object({
        current: zod_1.z.number().int().nonnegative().optional(),
        best: zod_1.z.number().int().nonnegative().optional(),
        lastDay: zod_1.z.string().nullable().optional(),
    })
        .optional(),
    tasks: zod_1.z.array(missions_1.MissionTaskSchema).max(10),
});
function mergeMissionState(current, updates) {
    const baseDayKey = current?.dayKey ?? new Date().toDateString();
    const baseStreak = current?.streak ?? { current: 0, best: 0, lastDay: null };
    return {
        dayKey: updates.dayKey ?? baseDayKey,
        totalCompleted: updates.totalCompleted ?? current?.totalCompleted ?? 0,
        streak: {
            current: updates.streak?.current ?? baseStreak.current ?? 0,
            best: updates.streak?.best ?? baseStreak.best ?? 0,
            lastDay: updates.streak && "lastDay" in updates.streak
                ? updates.streak.lastDay ?? null
                : baseStreak.lastDay ?? null,
        },
        tasks: updates.tasks ?? [],
        version: current?.version,
        updated_at: current?.updated_at,
    };
}
router.get("/", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid) {
            status = 401;
            return res.status(401).json({ ok: false, error: "unauthorized" });
        }
        const state = await (0, missions_1.fetchMissionState)(uid);
        return res.json({ ok: true, tasks: state?.tasks ?? [], state });
    }
    catch (err) {
        status = 500;
        log.error({ err }, "GET /tasks failed");
        return res.status(500).json({ ok: false, error: "internal error" });
    }
    finally {
        (0, metrics_1.observeApi)("tasks_get", "GET", status, timer);
    }
});
router.post("/", async (req, res) => {
    const timer = (0, metrics_1.metricsTimer)();
    let status = 200;
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid) {
            status = 401;
            return res.status(401).json({ ok: false, error: "unauthorized" });
        }
        const data = TaskSyncSchema.parse(req.body || {});
        const existing = await (0, missions_1.fetchMissionState)(uid);
        const merged = mergeMissionState(existing, data);
        const state = await (0, missions_1.saveMissionState)(uid, merged);
        return res.json({ ok: true, tasks: state.tasks, state });
    }
    catch (err) {
        const tagged = err?.name === "ZodError" ? 400 : 500;
        status = tagged;
        log.error({ err }, "POST /tasks failed");
        return res.status(tagged).json({ ok: false, error: err?.message || "internal error" });
    }
    finally {
        (0, metrics_1.observeApi)("tasks_sync", "POST", status, timer);
    }
});
exports.default = router;

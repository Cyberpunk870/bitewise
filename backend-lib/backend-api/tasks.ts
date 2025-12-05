// backend-lib/backend-api/tasks.ts
import express from "express";
import { z } from "zod";
import logger from "../lib/logger";
import {
  MissionState,
  MissionTaskSchema,
  fetchMissionState,
  saveMissionState,
} from "./missions";
import { metricsTimer, observeApi } from "../lib/metrics";

const router = express.Router();
const log = logger.child({ module: "tasks" });

const TaskSyncSchema = z.object({
  dayKey: z.string().min(1).optional(),
  totalCompleted: z.number().int().nonnegative().optional(),
  streak: z
    .object({
      current: z.number().int().nonnegative().optional(),
      best: z.number().int().nonnegative().optional(),
      lastDay: z.string().nullable().optional(),
    })
    .optional(),
  tasks: z.array(MissionTaskSchema).max(10),
});

function mergeMissionState(
  current: MissionState | null,
  updates: z.infer<typeof TaskSyncSchema>
): MissionState {
  const baseDayKey = current?.dayKey ?? new Date().toDateString();
  const baseStreak = current?.streak ?? { current: 0, best: 0, lastDay: null };

  return {
    dayKey: updates.dayKey ?? baseDayKey,
    totalCompleted: updates.totalCompleted ?? current?.totalCompleted ?? 0,
    streak: {
      current: updates.streak?.current ?? baseStreak.current ?? 0,
      best: updates.streak?.best ?? baseStreak.best ?? 0,
      lastDay:
        updates.streak && "lastDay" in updates.streak
          ? updates.streak.lastDay ?? null
          : baseStreak.lastDay ?? null,
    },
    tasks: updates.tasks ?? [],
    version: current?.version,
    updated_at: current?.updated_at,
  };
}

router.get("/", async (req: any, res) => {
  const timer = metricsTimer();
  let status = 200;
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) {
      status = 401;
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const state = await fetchMissionState(uid);
    return res.json({ ok: true, tasks: state?.tasks ?? [], state });
  } catch (err: any) {
    status = 500;
    log.error({ err }, "GET /tasks failed");
    return res.status(500).json({ ok: false, error: "internal error" });
  } finally {
    observeApi("tasks_get", "GET", status, timer);
  }
});

router.post("/", async (req: any, res) => {
  const timer = metricsTimer();
  let status = 200;
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) {
      status = 401;
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const data = TaskSyncSchema.parse(req.body || {});
    const existing = await fetchMissionState(uid);
    const merged = mergeMissionState(existing, data);
    const state = await saveMissionState(uid, merged);
    return res.json({ ok: true, tasks: state.tasks, state });
  } catch (err: any) {
    const tagged = err?.name === "ZodError" ? 400 : 500;
    status = tagged;
    log.error({ err }, "POST /tasks failed");
    return res.status(tagged).json({ ok: false, error: err?.message || "internal error" });
  } finally {
    observeApi("tasks_sync", "POST", status, timer);
  }
});

export default router;

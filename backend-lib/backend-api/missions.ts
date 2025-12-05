// backend-lib/backend-api/missions.ts
import { Router } from "express";
import { z } from "zod";
import { getFirestore } from "firebase-admin/firestore";
import logger from "../lib/logger";
import { metricsTimer, observeApi } from "../lib/metrics";
import { ensureAdmin } from "../lib/firebaseAdmin";

const log = logger.child({ module: "missions" });

const router = Router();

export const MissionTaskSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  target: z.number().int().nonnegative(),
  reward: z.number().int().nonnegative(),
  day: z.number().int().nonnegative(),
  progress: z.number().int().nonnegative(),
  ready: z.boolean(),
  done: z.boolean(),
  dueTs: z.number().optional().nullable(),
});

export const MissionStateSchema = z.object({
  dayKey: z.string().min(1),
  totalCompleted: z.number().int().nonnegative(),
  streak: z.object({
    current: z.number().int().nonnegative(),
    best: z.number().int().nonnegative(),
    lastDay: z.string().nullable().optional(),
  }),
  tasks: z.array(MissionTaskSchema).max(10),
  version: z.number().int().nonnegative().optional(),
  updated_at: z.string().optional(),
});

export type MissionState = z.infer<typeof MissionStateSchema>;

export function missionDoc(uid: string) {
  return getFirestore()
    .collection("users")
    .doc(uid)
    .collection("missions")
    .doc("state");
}

function sanitizeTasks(list: MissionState["tasks"]) {
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

export async function fetchMissionState(uid: string): Promise<MissionState | null> {
  const snap = await missionDoc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const parsed = MissionStateSchema.safeParse({
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

export async function saveMissionState(uid: string, raw: unknown): Promise<MissionState> {
  const normalized =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const input = MissionStateSchema.parse({
    ...(normalized as Record<string, unknown>),
    version: undefined,
    updated_at: undefined,
  });
  const payload: MissionState = {
    ...input,
    tasks: sanitizeTasks(input.tasks),
    updated_at: new Date().toISOString(),
    version: Date.now(),
  };
  await missionDoc(uid).set(payload, { merge: true });
  return payload;
}

router.get("/state", async (req: any, res) => {
  const timer = metricsTimer();
  let status = 200;
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) {
      status = 401;
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    ensureAdmin();
    const state = await Promise.race([
      fetchMissionState(uid),
      new Promise<null>((_r, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    return res.json({ ok: true, state });
  } catch (err: any) {
    status = 500;
    log.error({ err }, "GET /missions/state failed");
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "internal error" });
  } finally {
    observeApi("missions_state_get", "GET", status, timer);
  }
});

router.post("/state", async (req: any, res) => {
  const timer = metricsTimer();
  let status = 200;
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) {
      status = 401;
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    ensureAdmin();
    const state = await Promise.race([
      saveMissionState(uid, req.body),
      new Promise<null>((_r, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    return res.json({ ok: true, state });
  } catch (err: any) {
    const tagged = err?.name === "ZodError" ? 400 : 500;
    status = tagged;
    log.error({ err }, "POST /missions/state failed");
    return res.status(tagged).json({
      ok: false,
      error: err?.message || "internal error",
    });
  } finally {
    observeApi("missions_state_post", "POST", status, timer);
  }
});

export default router;

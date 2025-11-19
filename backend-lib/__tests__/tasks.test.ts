import express from "express";
import request from "supertest";
import tasksRouter from "../backend-api/tasks";
import { firestoreMock } from "../test-utils/firestoreMock";

jest.mock("firebase-admin/firestore", () => {
  const mock = require("../test-utils/firestoreMock");
  return {
    getFirestore: () => mock.firestoreMock,
    FieldValue: mock.FieldValueStub,
  };
});

function buildApp(uid = "tasks-user") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { uid };
    (req as any).uid = uid;
    next();
  });
  app.use("/tasks", tasksRouter);
  return app;
}

describe("tasks api", () => {
  it("returns an empty list when no mission state exists", async () => {
    const app = buildApp("no-state");
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.state).toBeNull();
  });

  it("persists task payloads via mission state", async () => {
    const app = buildApp("sync-user");
    const payload = {
      dayKey: "Mon Feb 10 2025",
      totalCompleted: 1,
      streak: { current: 1, best: 2, lastDay: "Mon Feb 10 2025" },
      tasks: [
        {
          id: "task-1",
          kind: "compare_open",
          title: "Open Compare",
          target: 1,
          reward: 7,
          day: 1,
          progress: 0,
          ready: false,
          done: false,
          dueTs: Date.now(),
        },
      ],
    };

    const res = await request(app).post("/tasks").send(payload);
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);

    const stored = firestoreMock.getDoc("users/sync-user/missions", "state");
    expect(stored?.tasks).toHaveLength(1);
    expect(stored?.streak?.current).toBe(1);

    const reread = await request(app).get("/tasks");
    expect(reread.body.tasks).toHaveLength(1);
    expect(reread.body.state.dayKey).toBe(payload.dayKey);
  });
});

import express from "express";
import request from "supertest";
import missionsRouter from "../backend-api/missions";
import { firestoreMock } from "../test-utils/firestoreMock";

jest.mock("firebase-admin/firestore", () => {
  const mock = require("../test-utils/firestoreMock");
  return {
    getFirestore: () => mock.firestoreMock,
    FieldValue: mock.FieldValueStub,
  };
});

function buildApp(uid = "missions-user") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { uid };
    (req as any).uid = uid;
    next();
  });
  app.use("/missions", missionsRouter);
  return app;
}

describe("missions api", () => {
  it("returns null state when no doc exists", async () => {
    const app = buildApp();
    const res = await request(app).get("/missions/state");
    expect(res.status).toBe(200);
    expect(res.body.state).toBeNull();
  });

  it("persists mission state and returns sanitized payload", async () => {
    const app = buildApp("mission-writer");
    const payload = {
      dayKey: "Mon Jan 20 2025",
      totalCompleted: 4,
      streak: { current: 2, best: 4, lastDay: "Mon Jan 20 2025" },
      tasks: [
        {
          id: "t1",
          kind: "search",
          title: "Search once",
          target: 1,
          reward: 5,
          day: 1,
          progress: 1,
          ready: true,
          done: false,
          dueTs: Date.now(),
        },
      ],
    };

    const write = await request(app).post("/missions/state").send(payload);
    expect(write.status).toBe(200);
    expect(write.body.state.version).toBeGreaterThan(0);

    const stored = firestoreMock.getDoc("users/mission-writer/missions", "state");
    expect(stored).toBeTruthy();
    expect(stored?.tasks).toHaveLength(1);
    expect(stored?.streak?.current).toBe(2);

    const read = await request(app).get("/missions/state");
    expect(read.status).toBe(200);
    expect(read.body.state.dayKey).toBe(payload.dayKey);
    expect(read.body.state.tasks).toHaveLength(1);
  });
});

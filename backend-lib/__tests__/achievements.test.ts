import express from "express";
import request from "supertest";
import achievementsRouter, {
  awardAchievement,
} from "../backend-api/achievements";
import { firestoreMock } from "../test-utils/firestoreMock";

jest.mock("firebase-admin/firestore", () => {
  const mock = require("../test-utils/firestoreMock");
  return {
    getFirestore: () => mock.firestoreMock,
    FieldValue: mock.FieldValueStub,
  };
});

function buildApp(uid = "achiever") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { uid };
    (req as any).uid = uid;
    next();
  });
  app.use("/achievements", achievementsRouter);
  return app;
}

describe("achievements api", () => {
  it("lists achievements for the authenticated user", async () => {
    await awardAchievement({
      user_id: "achiever",
      code: "warmup",
      title: "Warm Up",
      points: 5,
    });
    const other = firestoreMock.collection("achievements");
    await other.doc("other__warmup").set({
      id: "other__warmup",
      user_id: "someone-else",
      code: "warmup",
      title: "Warm Up",
      points: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      earned_at: new Date().toISOString(),
    });

    const app = buildApp();
    const res = await request(app).get("/achievements");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user_id).toBe("achiever");
  });

  it("awards achievements idempotently via POST", async () => {
    const app = buildApp("repeat-user");

    const payload = { code: "first_compare", title: "First Compare", points: 10 };
    const first = await request(app).post("/achievements").send(payload);
    expect(first.status).toBe(200);
    const second = await request(app).post("/achievements").send(payload);
    expect(second.status).toBe(200);

    const doc = firestoreMock.getDoc("achievements", "repeat-user__first_compare");
    expect(doc).toBeTruthy();
    expect(doc?.points).toBe(10);

    const res = await request(app).get("/achievements");
    expect(res.body.data).toHaveLength(1);
  });
});

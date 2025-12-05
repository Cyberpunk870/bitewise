import express from "express";
import request from "supertest";
import profileRouter from "../backend-api/user/profile";
import { firestoreMock } from "../test-utils/firestoreMock";

jest.mock("firebase-admin/firestore", () => {
  const mock = require("../test-utils/firestoreMock");
  return {
    getFirestore: () => mock.firestoreMock,
    FieldValue: mock.FieldValueStub,
  };
});

function buildApp(uid = "profile-user") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { uid };
    (req as any).uid = uid;
    next();
  });
  app.use("/user/profile", profileRouter);
  return app;
}

function computeWeekId() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

describe("user profile api", () => {
  it("hydrates achievements and leaderboard rank", async () => {
    const weekId = computeWeekId();
    const achievements = firestoreMock.collection("achievements");
    await achievements.doc("ach-1").set({
      id: "ach-1",
      user_id: "profile-user",
      code: "first_save",
      points: 10,
      earned_at: "2025-01-01T00:00:00.000Z",
    });

    const leaderboard = firestoreMock.collection("leaderboard");
    await leaderboard.doc(`profile-user__${weekId}__global`).set({
      id: `profile-user__${weekId}__global`,
      user_id: "profile-user",
      week_id: weekId,
      region: "global",
      score: 90,
      updated_at: "2025-02-01T00:00:00.000Z",
    });
    await leaderboard.doc(`other__${weekId}__global`).set({
      id: `other__${weekId}__global`,
      user_id: "other",
      week_id: weekId,
      region: "global",
      score: 120,
      updated_at: "2025-02-01T00:00:00.000Z",
    });

    const app = buildApp();
    const res = await request(app).get("/user/profile");

    expect(res.status).toBe(200);
    expect(res.body.profile.uid).toBe("profile-user");
    expect(res.body.profile.achievements).toHaveLength(1);
    expect(res.body.profile.rank).toBe(2);
  });

  it("updates basic profile fields and enforces unique phone numbers", async () => {
    const app = buildApp();
    const update = await request(app)
      .post("/user/profile")
      .send({ name: "Ava Bytes", phone: "+911111111" });

    expect(update.status).toBe(200);

    const stored = firestoreMock.getDoc("users", "profile-user");
    expect(stored?.name).toBe("Ava Bytes");
    expect(stored?.phone).toBe("+911111111");

    const other = firestoreMock.collection("users");
    await other.doc("existing").set({ id: "existing", phone: "+922222222" });

    const conflict = await request(app)
      .post("/user/profile")
      .send({ phone: "+922222222" });

    expect(conflict.status).toBe(409);
  });
});

import express from "express";
import request from "supertest";
import ordersRouter from "../backend-api/orders";
import * as leaderboardMod from "../backend-api/leaderboard";
import * as achievementsMod from "../backend-api/achievements";
import { firestoreMock } from "../test-utils/firestoreMock";

jest.mock("firebase-admin/firestore", () => {
  const mock = require("../test-utils/firestoreMock");
  return {
    getFirestore: () => mock.firestoreMock,
    FieldValue: mock.FieldValueStub,
  };
});

jest.mock("../backend-api/leaderboard", () => ({
  bumpScore: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("../backend-api/achievements", () => ({
  ensureAchievement: jest.fn().mockResolvedValue({ ok: true }),
}));

function buildApp(uid = "test-user") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { uid };
    (req as any).uid = uid;
    next();
  });
  app.use("/orders", ordersRouter);
  return app;
}

describe("orders api", () => {
  it("persists outbound events with computed savings", async () => {
    const app = buildApp("order-writer");

    const response = await request(app)
      .post("/orders/outbound")
      .send({
        platform: "swiggy",
        dish_name: "Paneer Tikka",
        total: 180,
        otherTotal: 240,
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    const events = firestoreMock.dumpCollection("order_events");
    expect(events).toHaveLength(1);
    const saved = events[0].data;
    expect(saved.platform_price).toBe(180);
    expect(saved.compare_price).toBe(240);
    expect(saved.saved_amount).toBe(60);
    expect(saved.user_id).toBe("order-writer");
  });

  it("marks completion once and updates totals", async () => {
    const now = new Date().toISOString();
    const col = firestoreMock.collection("order_events");
    await col.doc("evt-1").set({
      id: "evt-1",
      user_id: "finish-user",
      platform: "zomato",
      dish_name: "Biryani",
      compare_price: 250,
      platform_price: 200,
      saved_amount: 50,
      outcome: "viewed",
      created_at: now,
      updated_at: now,
    });

    const app = buildApp("finish-user");

    const firstAttempt = await request(app)
      .post("/orders/complete")
      .send({ id: "evt-1", saved_amount: 45 });

    expect(firstAttempt.status).toBe(200);

    const updated = firestoreMock.getDoc("order_events", "evt-1");
    expect(updated?.completed_at).toBeTruthy();
    expect(updated?.saved_amount).toBe(45);

    const userDoc = firestoreMock.getDoc("users", "finish-user");
    expect(userDoc?.total_savings).toBe(45);
    expect(userDoc?.total_orders).toBe(1);

    const secondAttempt = await request(app)
      .post("/orders/complete")
      .send({ id: "evt-1", saved_amount: 90 });

    expect(secondAttempt.status).toBe(200);
    const userDocAfter = firestoreMock.getDoc("users", "finish-user");
    expect(userDocAfter?.total_orders).toBe(1);
    expect(userDocAfter?.total_savings).toBe(45);

    const bumpScoreMock = leaderboardMod.bumpScore as jest.Mock;
    expect(bumpScoreMock).toHaveBeenCalledTimes(1);

    const ensureAchievementMock = achievementsMod.ensureAchievement as jest.Mock;
    expect(ensureAchievementMock).toHaveBeenCalled();
  });

  it("returns recent order events for the authenticated user", async () => {
    const col = firestoreMock.collection("order_events");
    await col.doc("evt-a").set({
      id: "evt-a",
      user_id: "list-user",
      platform: "swiggy",
      dish_name: "Idli",
      compare_price: 120,
      platform_price: 100,
      saved_amount: 20,
      created_at: "2025-02-01T00:00:00.000Z",
      updated_at: "2025-02-01T00:00:00.000Z",
    });
    await col.doc("evt-b").set({
      id: "evt-b",
      user_id: "list-user",
      platform: "zomato",
      dish_name: "Dosa",
      compare_price: 200,
      platform_price: 150,
      saved_amount: 50,
      created_at: "2025-02-02T00:00:00.000Z",
      updated_at: "2025-02-02T00:00:00.000Z",
    });
    await col.doc("evt-c").set({
      id: "evt-c",
      user_id: "other-user",
      platform: "swiggy",
      dish_name: "Chaat",
      compare_price: 90,
      platform_price: 80,
      saved_amount: 10,
      created_at: "2025-02-03T00:00:00.000Z",
      updated_at: "2025-02-03T00:00:00.000Z",
    });

    const app = buildApp("list-user");
    const res = await request(app).get("/orders");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe("evt-b");
    expect(res.body.data[1].id).toBe("evt-a");
  });
});

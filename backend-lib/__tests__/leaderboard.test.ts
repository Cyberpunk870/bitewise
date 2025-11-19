import express from "express";
import request from "supertest";
import leaderboardRouter from "../backend-api/leaderboard";
import { firestoreMock } from "../test-utils/firestoreMock";
import { bumpScore } from "../backend-api/leaderboard";

jest.mock("firebase-admin/firestore", () => {
  const mock = require("../test-utils/firestoreMock");
  return {
    getFirestore: () => mock.firestoreMock,
    FieldValue: mock.FieldValueStub,
  };
});

describe("leaderboard api", () => {
  it("returns sorted leaderboard rows for the requested week", async () => {
    const col = firestoreMock.collection("leaderboard");
    await col.doc("u1__2025-W10__global").set({
      id: "u1__2025-W10__global",
      user_id: "u1",
      week_id: "2025-W10",
      region: "global",
      score: 120,
      updated_at: "2025-02-01T00:00:00.000Z",
    });
    await col.doc("u2__2025-W10__global").set({
      id: "u2__2025-W10__global",
      user_id: "u2",
      week_id: "2025-W10",
      region: "global",
      score: 240,
      updated_at: "2025-02-01T00:00:00.000Z",
    });

    const app = express();
    app.use("/leaderboard", leaderboardRouter);

    const res = await request(app)
      .get("/leaderboard")
      .query({ week_id: "2025-W10", region: "global" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].user_id).toBe("u2");
    expect(res.body.data[1].user_id).toBe("u1");
  });

  it("increments weekly totals when bumpScore is invoked", async () => {
    const before = firestoreMock.getDoc("leaderboard", "score-user__2025-W01__global");
    expect(before).toBeUndefined();

    await bumpScore("score-user", 75, "2025-W01", "global");

    const entry = firestoreMock.getDoc("leaderboard", "score-user__2025-W01__global");
    expect(entry?.score).toBe(75);

    await bumpScore("score-user", 25, "2025-W01", "global");
    const updated = firestoreMock.getDoc("leaderboard", "score-user__2025-W01__global");
    expect(updated?.score).toBe(100);
  });
});

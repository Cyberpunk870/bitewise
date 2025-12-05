import request from "supertest";
import { resetFirestoreMock, firestoreMock } from "../test-utils/firestoreMock";

process.env.ADMIN_SHARED_SECRET = "test-secret";

jest.mock("../lib/firebaseAdmin", () => ({
  ensureAdmin: jest.fn(),
}));

jest.mock("firebase-admin/app", () => ({
  getApps: () => [],
  initializeApp: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => {
  const mock = require("../test-utils/firestoreMock");
  return {
    getFirestore: () => mock.firestoreMock,
    FieldValue: mock.FieldValueStub,
  };
});

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: "user-from-token" }),
  }),
}));

jest.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({
    sendEachForMulticast: jest.fn().mockResolvedValue({ responses: [] }),
  }),
}));

// Import after mocks are in place.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require("../app").default;

describe("push + feedback smoke", () => {
  beforeEach(() => {
    resetFirestoreMock();
  });

  it("stores feedback submissions", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .set("x-admin-secret", "test-secret")
      .send({
        message: "Broken navigation",
        steps: "1) open 2) tap cart",
        category: "bug",
        severity: "high",
        deviceInfo: "Chrome",
        screen: "/home",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const saved = firestoreMock.dumpCollection("feedback");
    expect(saved).toHaveLength(1);
    expect(saved[0].data.uid).toBe("admin-shared-secret");
    expect(saved[0].data.message).toContain("Broken navigation");
  });

  it("registers push tokens and reports status", async () => {
    const register = await request(app)
      .post("/api/push/register")
      .set("x-admin-secret", "test-secret")
      .send({ token: "token-123" });

    expect(register.status).toBe(200);
    expect(register.body.ok).toBe(true);

    const status = await request(app)
      .get("/api/push/status")
      .set("x-admin-secret", "test-secret");

    expect(status.status).toBe(200);
    expect(status.body.registered).toBe(true);
    expect(status.body.count).toBe(1);
  });
});

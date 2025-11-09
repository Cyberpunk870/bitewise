// backend-lib/backend-api/user.ts
import { Router } from "express";
import { verifyAuth as authMiddleware } from "../middleware/verifyAuth"; // Adjust this path if needed

const router = Router();

// Dummy in-memory user DB (replace with actual DB logic)
const users: Record<string, any> = {};

// GET /user/profile
router.get("/profile", authMiddleware, (req, res) => {
  console.log("✅ GET /user/profile HIT");
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const user = users[uid] || {};
  res.json({ ok: true, profile: user });
});

// ✅ FIXED: POST /user/profile
router.post("/profile", authMiddleware, (req, res) => {
  console.log("✅ POST /user/profile HIT");
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const { name, phone } = req.body;
  users[uid] = { ...users[uid], name, phone };
  res.json({ ok: true, profile: users[uid] });
});

export default router;
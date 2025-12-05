// backend-lib/backend-api/user/index.ts

import { Router } from "express";
import profileRouter from "./profile";
import addressesRouter from "./addresses";
import { addCoins as addCoinsSvc, getCoinsSummary } from "./coins";

const router = Router();

router.use("/profile", profileRouter);
router.use("/addresses", addressesRouter);

router.post("/coins/add", async (req: any, res) => {
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const result = await addCoinsSvc({ ...req.body, uid });
    res.json(result);
  } catch (err: any) {
    const status = err?.name === "ZodError" ? 400 : 500;
    res.status(status).json({ ok: false, error: err?.message || "internal error" });
  }
});

router.get("/coins/summary", async (req: any, res) => {
  try {
    const uid = req.user?.uid || req.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const result = await getCoinsSummary(uid);
    res.json(result);
  } catch (err: any) {
    const status = err?.name === "ZodError" ? 400 : 500;
    res.status(status).json({ ok: false, error: err?.message || "internal error" });
  }
});

export default router;

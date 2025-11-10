// backend-lib/backend-api/user/index.ts

import { Router } from "express";
import profileRouter from "./profile";
import addressesRouter from "./addresses";

const router = Router();

router.use("/profile", profileRouter);
router.use("/addresses", addressesRouter);

export default router;

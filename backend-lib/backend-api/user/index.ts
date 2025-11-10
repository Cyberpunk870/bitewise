// backend-lib/backend-api/user/index.ts

import { Router } from "express";
import profile from "./profile";
import addresses from "./addresses";

const router = Router();

router.use("/profile", profile);
router.use("/addresses", addresses);

export default router;

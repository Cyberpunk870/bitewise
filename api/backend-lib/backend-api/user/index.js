"use strict";
// backend-lib/backend-api/user/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profile_1 = __importDefault(require("./profile"));
const addresses_1 = __importDefault(require("./addresses"));
const coins_1 = require("./coins");
const router = (0, express_1.Router)();
router.use("/profile", profile_1.default);
router.use("/addresses", addresses_1.default);
router.post("/coins/add", async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const result = await (0, coins_1.addCoins)({ ...req.body, uid });
        res.json(result);
    }
    catch (err) {
        const status = err?.name === "ZodError" ? 400 : 500;
        res.status(status).json({ ok: false, error: err?.message || "internal error" });
    }
});
router.get("/coins/summary", async (req, res) => {
    try {
        const uid = req.user?.uid || req.uid;
        if (!uid)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const result = await (0, coins_1.getCoinsSummary)(uid);
        res.json(result);
    }
    catch (err) {
        const status = err?.name === "ZodError" ? 400 : 500;
        res.status(status).json({ ok: false, error: err?.message || "internal error" });
    }
});
exports.default = router;

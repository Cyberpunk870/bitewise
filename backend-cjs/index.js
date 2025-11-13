"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// bitewise/server/index.ts
const app_1 = __importDefault(require("./app"));
const port = Number(process.env.PORT) || 3000;
app_1.default.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});

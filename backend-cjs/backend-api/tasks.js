"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTasks = getTasks;
// server/api/tasks.ts
const db_1 = require("../lib/db");
const response_1 = require("../lib/response");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
async function getTasks() {
    const tasks = (0, db_1.getAll)('tasks');
    return (0, response_1.ok)(tasks);
}
exports.default = router;

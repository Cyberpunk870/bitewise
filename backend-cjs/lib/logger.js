"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = void 0;
const pino_1 = __importDefault(require("pino"));
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
const baseLogger = (0, pino_1.default)({
    level,
    base: {
        env: process.env.NODE_ENV || "development",
        service: "bitewise-backend",
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
});
const getLogger = (bindings) => bindings ? baseLogger.child(bindings) : baseLogger;
exports.getLogger = getLogger;
exports.default = baseLogger;

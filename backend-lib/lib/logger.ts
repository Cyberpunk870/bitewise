import pino from "pino";

const level =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

const baseLogger = pino({
  level,
  base: {
    env: process.env.NODE_ENV || "development",
    service: "bitewise-backend",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const getLogger = (bindings?: pino.Bindings) =>
  bindings ? baseLogger.child(bindings) : baseLogger;

export default baseLogger;

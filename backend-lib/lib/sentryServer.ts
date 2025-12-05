import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";

let inited = false;

export function initSentryServer() {
  const dsn = process.env.SENTRY_DSN || "";
  if (!dsn) return;
  if (inited) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.05"),
  });
  inited = true;
}

export const sentryRequestHandler = () => {
  initSentryServer();
  const anySentry = Sentry as any;
  if (typeof anySentry.setupExpressRequestHandler === "function") {
    return anySentry.setupExpressRequestHandler();
  }
  if (anySentry.Handlers?.requestHandler) return anySentry.Handlers.requestHandler();
  return (_req: any, _res: any, next: any) => next();
};

export const sentryErrorHandler = () => {
  initSentryServer();
  const anySentry = Sentry as any;
  if (typeof anySentry.setupExpressErrorHandler === "function") {
    return anySentry.setupExpressErrorHandler();
  }
  if (anySentry.Handlers?.errorHandler) return anySentry.Handlers.errorHandler();
  return (_err: any, _req: any, _res: any, next: any) => next();
};

export const sentryCapture = (err: unknown, context?: Record<string, unknown>) => {
  if (!inited) return;
  Sentry.captureException(err, { extra: context });
};

export function withSentry(fn: (req: Request, res: Response, next: NextFunction) => any) {
  return function sentryWrapped(req: Request, res: Response, next: NextFunction) {
    initSentryServer();
    const anySentry = Sentry as any;
    const wrap = anySentry.wrapHandler || anySentry.Handlers?.wrapMiddleware;
    if (wrap) return wrap(fn)(req, res, next);
    return fn(req, res, next);
  };
}

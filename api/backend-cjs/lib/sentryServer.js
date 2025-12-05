"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentryCapture = exports.sentryErrorHandler = exports.sentryRequestHandler = void 0;
exports.initSentryServer = initSentryServer;
exports.withSentry = withSentry;
const Sentry = __importStar(require("@sentry/node"));
let inited = false;
function initSentryServer() {
    const dsn = process.env.SENTRY_DSN || "";
    if (!dsn)
        return;
    if (inited)
        return;
    Sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
        release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.05"),
    });
    inited = true;
}
const sentryRequestHandler = () => {
    initSentryServer();
    const anySentry = Sentry;
    if (typeof anySentry.setupExpressRequestHandler === "function") {
        return anySentry.setupExpressRequestHandler();
    }
    if (anySentry.Handlers?.requestHandler)
        return anySentry.Handlers.requestHandler();
    return (_req, _res, next) => next();
};
exports.sentryRequestHandler = sentryRequestHandler;
const sentryErrorHandler = () => {
    initSentryServer();
    const anySentry = Sentry;
    if (typeof anySentry.setupExpressErrorHandler === "function") {
        return anySentry.setupExpressErrorHandler();
    }
    if (anySentry.Handlers?.errorHandler)
        return anySentry.Handlers.errorHandler();
    return (_err, _req, _res, next) => next();
};
exports.sentryErrorHandler = sentryErrorHandler;
const sentryCapture = (err, context) => {
    if (!inited)
        return;
    Sentry.captureException(err, { extra: context });
};
exports.sentryCapture = sentryCapture;
function withSentry(fn) {
    return function sentryWrapped(req, res, next) {
        initSentryServer();
        const anySentry = Sentry;
        const wrap = anySentry.wrapHandler || anySentry.Handlers?.wrapMiddleware;
        if (wrap)
            return wrap(fn)(req, res, next);
        return fn(req, res, next);
    };
}

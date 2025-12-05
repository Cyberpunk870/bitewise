"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateServerEnv = validateServerEnv;
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("./logger"));
const log = logger_1.default.child({ module: "env-validation" });
function hasServiceAccount() {
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const jsonB64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    if (path && fs_1.default.existsSync(path))
        return { ok: true, source: `file:${path}` };
    if (json)
        return { ok: true, source: "json-env" };
    if (jsonB64) {
        try {
            const decoded = Buffer.from(jsonB64, "base64").toString("utf8");
            JSON.parse(decoded);
            return { ok: true, source: "json-b64" };
        }
        catch {
            return { ok: false };
        }
    }
    return { ok: false };
}
function validateServerEnv(opts = {}) {
    const strict = opts.strict !== false;
    const errors = [];
    const warnings = [];
    const sa = hasServiceAccount();
    if (!sa.ok) {
        errors.push("Missing Firebase service account (set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON[_BASE64]).");
    }
    if (!process.env.CLIENT_ORIGINS) {
        warnings.push("CLIENT_ORIGINS not set; CORS will rely on defaults only.");
    }
    if (!process.env.ADMIN_SHARED_SECRET) {
        warnings.push("ADMIN_SHARED_SECRET not set; admin routes rely solely on Firebase admin claims.");
    }
    if (process.env.ALLOW_CUSTOM_TOKEN_MINT === "1" && !process.env.CUSTOM_TOKEN_MINT_SECRET) {
        warnings.push("CUSTOM_TOKEN_MINT_SECRET missing while ALLOW_CUSTOM_TOKEN_MINT=1; mint endpoint would be open.");
    }
    if (!process.env.METRICS_TOKEN) {
        warnings.push("METRICS_TOKEN not set; /metrics will be publicly readable.");
    }
    if (strict && errors.length) {
        const err = new Error(`env validation failed: ${errors.join("; ")}`);
        log.error({ errors, warnings }, "Env validation failed");
        throw err;
    }
    if (warnings.length) {
        warnings.forEach((w) => log.warn({ warning: w }, "Env validation warning"));
    }
    if (sa.ok) {
        log.info({ source: sa.source }, "Firebase service account detected");
    }
    return { errors, warnings };
}

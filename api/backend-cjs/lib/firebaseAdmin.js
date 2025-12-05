"use strict";
// backend-lib/lib/firebaseAdmin.ts
// Shared helpers to lazily initialise firebase-admin with flexible credential loading.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAdmin = ensureAdmin;
const app_1 = require("firebase-admin/app");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
const log = logger_1.default.child({ module: "firebase-admin" });
const EMBEDDED_SERVICE_ACCOUNT_B64 = process.env.EMBEDDED_SERVICE_ACCOUNT_B64 || "";
function massagePrivateKey(sa) {
    if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
        sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    }
    return sa;
}
function tryReadJsonFile(saPath) {
    if (!saPath)
        return null;
    try {
        if (!fs_1.default.existsSync(saPath))
            return null;
        log.info({ saPath }, "using service account file");
        const raw = fs_1.default.readFileSync(saPath, "utf8");
        return massagePrivateKey(JSON.parse(raw));
    }
    catch (e) {
        log.error({ err: e, saPath }, "failed to read/parse service account file");
        throw e;
    }
}
function tryParseJsonEnv(value, label) {
    if (!value)
        return null;
    try {
        log.info({ label, length: value.length }, "using inline service account JSON");
        return massagePrivateKey(JSON.parse(value));
    }
    catch (e) {
        log.error({ err: e, label }, "inline service account JSON parse failed");
        throw e;
    }
}
function loadServiceAccount() {
    log.debug({ cwd: process.cwd() }, "process cwd");
    const candidatePaths = [
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        path_1.default.join(process.cwd(), "firebase", "service-account.json"),
        path_1.default.join(__dirname, "..", "firebase", "service-account.json"),
        path_1.default.join(__dirname, "..", "..", "firebase", "service-account.json"),
    ].filter(Boolean);
    log.debug({ candidatePaths }, "checking service account paths");
    for (const p of candidatePaths) {
        const sa = tryReadJsonFile(p);
        if (sa)
            return sa;
    }
    const json = tryParseJsonEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "FIREBASE_SERVICE_ACCOUNT_JSON");
    if (json)
        return json;
    const jsonB64Raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    if (jsonB64Raw) {
        try {
            const decoded = Buffer.from(jsonB64Raw, "base64").toString("utf8");
            const parsed = massagePrivateKey(JSON.parse(decoded));
            log.info("using service account credentials from FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
            return parsed;
        }
        catch (err) {
            log.error({ err }, "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 decode failed");
        }
    }
    log.error("missing Firebase credentials");
    throw new Error("Missing Firebase credentials. Provide FIREBASE_SERVICE_ACCOUNT_PATH, JSON, or JSON_BASE64.");
}
function ensureAdmin() {
    const before = (0, app_1.getApps)().length;
    if (!before) {
        const sa = loadServiceAccount();
        (0, app_1.initializeApp)({ credential: (0, app_1.cert)(sa) });
        log.info({ apps: (0, app_1.getApps)().length }, "firebase-admin initialised");
    }
}

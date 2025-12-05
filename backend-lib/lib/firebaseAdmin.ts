// backend-lib/lib/firebaseAdmin.ts
// Shared helpers to lazily initialise firebase-admin with flexible credential loading.

import {
  initializeApp as initAdmin,
  cert,
  type ServiceAccount,
  getApps,
} from "firebase-admin/app";
import fs from "fs";
import path from "path";
import logger from "./logger";

const log = logger.child({ module: "firebase-admin" });
const EMBEDDED_SERVICE_ACCOUNT_B64 = process.env.EMBEDDED_SERVICE_ACCOUNT_B64 || "";

type ServiceAccountLike = ServiceAccount & { private_key?: string };

function massagePrivateKey(sa: ServiceAccountLike): ServiceAccountLike {
  if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  return sa;
}

function tryReadJsonFile(saPath: string | undefined) {
  if (!saPath) return null;
  try {
    if (!fs.existsSync(saPath)) return null;
    log.info({ saPath }, "using service account file");
    const raw = fs.readFileSync(saPath, "utf8");
    return massagePrivateKey(JSON.parse(raw) as ServiceAccountLike);
  } catch (e) {
    log.error({ err: e, saPath }, "failed to read/parse service account file");
    throw e;
  }
}

function tryParseJsonEnv(value: string | undefined, label: string) {
  if (!value) return null;
  try {
    log.info({ label, length: value.length }, "using inline service account JSON");
    return massagePrivateKey(JSON.parse(value) as ServiceAccountLike);
  } catch (e) {
    log.error({ err: e, label }, "inline service account JSON parse failed");
    throw e;
  }
}

function loadServiceAccount(): ServiceAccount {
  log.debug({ cwd: process.cwd() }, "process cwd");
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(process.cwd(), "firebase", "service-account.json"),
    path.join(__dirname, "..", "firebase", "service-account.json"),
    path.join(__dirname, "..", "..", "firebase", "service-account.json"),
  ].filter(Boolean) as string[];
  log.debug({ candidatePaths }, "checking service account paths");
  for (const p of candidatePaths) {
    const sa = tryReadJsonFile(p);
    if (sa) return sa as ServiceAccount;
  }

  const json = tryParseJsonEnv(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    "FIREBASE_SERVICE_ACCOUNT_JSON"
  );
  if (json) return json as ServiceAccount;

  const jsonB64Raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (jsonB64Raw) {
    try {
      const decoded = Buffer.from(jsonB64Raw, "base64").toString("utf8");
      const parsed = massagePrivateKey(JSON.parse(decoded) as ServiceAccountLike);
      log.info(
        "using service account credentials from FIREBASE_SERVICE_ACCOUNT_JSON_BASE64"
      );
      return parsed as ServiceAccount;
    } catch (err) {
      log.error({ err }, "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 decode failed");
    }
  }

  log.error("missing Firebase credentials");
  throw new Error(
    "Missing Firebase credentials. Provide FIREBASE_SERVICE_ACCOUNT_PATH, JSON, or JSON_BASE64."
  );
}

export function ensureAdmin() {
  const before = getApps().length;
  if (!before) {
    const sa = loadServiceAccount();
    initAdmin({ credential: cert(sa) });
    log.info({ apps: getApps().length }, "firebase-admin initialised");
  }
}

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
const EMBEDDED_SERVICE_ACCOUNT_B64 =
  process.env.EMBEDDED_SERVICE_ACCOUNT_B64 ||
  "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYml0ZXdpc2UtOTMiLAogICJwcml2YXRlX2tleV9pZCI6ICJjNjIzY2FmNmVhOWE4MjliM2JmZjQyMGJiZDVhZWZiZWY2M2NlZTcwIiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUURTUjRGRVhzOTdXNTVaXG5xbnRyMGE5OUgzZW5oS1EzOUk1RUZDT2RzNTNaaEE3Z0Uvck9NM0dIdmo0T2RReEEyRFlKMk5pTWVOaXpWbFlqXG5wQkVHMjM5cjY1ZjBORWNLWU9CTVBmdDBCeHhpUFlxUGhlY2dMTUtLME41SUFmbVlkdURoTlR3UVZiZnpsWkVxXG5rNlN0Q0xGSlRBS3UyNEdkV1phdjJYem84d1BSeldJcjZjenlTYzBoak8xVlJpd3Fzc1VaOTlVRDBiRlMydDA5XG5sSXlPM3JBeDVZUnFVSXFieCtPUVFUQ3hJSnVsdjRNY0RuaC9uVTV1N1FsUVVhbXY4V2JqYkxjQ3hnVDNIbUpvXG5kSlEvbGNSU0FjSU5Ea29hdE5TaFVCaUd6Z1VJR2lIR2l1V2c5SG8zSWFlT1Q0VVZqWVRuM3N3cDQvbUZKdXJNXG5SeU9pYVN2M0FnTUJBQUVDZ2dFQVZNaHYzbGs3M3NqNTk3MDlOaU85VmYyeUNPRDZOWFZ0UnhXM3BvWWRSdTV2XG44UGtkVHJaL04vUUVvVitnS1NVRDVNU0J5MkdPUGdDNWluVkVTRGVJRU1OVTZTbUsyeXhrUTFsYVlWWGNvOStjXG5Wbkh1MXBJMWZqTG83SytmSzFJREtjcUZCVEVLa2pQajYvN0xqdGpLWW5zN09iVlhkVklCNTdVUkgvdWJ0cU1WXG5mWTdKWGFNd3JuL2tydlRvc2NwdzBwS2lwS08xQlBQWnVNc1dKUjUrZ2dJVHAwYzZFTEFQMnBSYXBtc2NJNmErXG5iVlZVWDRRNmFEZytseUw3WXY2YnNYbC9tUHRqM2d3bnpHNE1rNm5KQWZadzEwcHFuV0xOSEVRUFE2Sms5UWQ3XG5Sc0VxK1VtWGpyRG9RY3BPR3c4TkRzZkFxTHJnTGlRRGVlYnRDT253Z1FLQmdRRHpDNng1dWV1QnY5M2ZvRVhaXG53R0NETXljSFN3c2V3cEZBZFY1R1ZSRFpCb0RRV1hGYTBBaTFEdk9NWnlqR1VnNFpvcHM2OVdhTExDUDdQeklOXG43TXpuRVZCa3hNNC9BbHN1UGlZNlcyQmYzQ3ltMmJ1cmN5emYvVVNFSENVUmlTejRYbnBrbVgzMmJEMHpQdGx5XG5HT1lZSXBrVzhOd3FPWFN3dEpQd1YwcVhQd0tCZ1FEZGZMMUwrQ1phRjFuRVVoYk5SaGlSYzNSS0RCd2ZUbzM4XG5KV2VBSHNtSzVrRERlZkRzSW5SaVFNY3lhQ090TVBGVmNFU2twd3BCalNvdVBOSTcxSS9iV293UzBaWWxxVVdxXG5ncHIrZndDa3dOem9PVllxb1lLOUZCdEhkUE84OEFxSWhjaVA5c0ZNbXlVR3hPODNTUEpmRXJzaVJKOC9ER2xIXG5YYjNVTWl3MVNRS0JnREJySXZFZEdNM0FhM01oZXNqbWlsT1kzUzJXeGFCYklwUzB6Uk0xM3lWZEpreGJoVG1TXG5PQ25aMEtzbjRmZWdZUzY2TmpLSXNPVUk1aUluZE5GUlc0Q3M4bGNnM2ZXdmducXo1dW01U25uT1l4YmFTWWplXG5hUkkyWW0vdkszTlM0S0thTDhmYXpEMUxVdVhpbjI4YmhydElLVGRveEhPay9wbzFYME9DSUZvQkFvR0JBTlcrXG5vYmdFM0k0bzVycHROaEFYeTNIaTU2RG1HdVdqbTZad09uZ01QaGZMcVVoOEQ2THloVHFrcFJmaUpEdnBkWjBzXG5ZVEk4K2NyVS9wWHNvRDZaSGROa2lMVklpZ3dDVlhiOTM3SW13bW84clhOMmtjOUdXck02Q2pGbGppc1J4RGlJXG5VMHVMcUhQVGJXSWcvM0pzOVdvRzI0MXdoL1lDZGo4bkdpRUQ0bUh4QW9HQUU0VVNPM1lKbTNBVjd0dTdjQmovXG5QTUF6YXEzVWFqYWFDaFFWRDgvWkxWbHRCZUR6NFdkSXF5N0VKSzRvalpOZTNZQlNFYXNubmJDZUhOQThycGNDXG55c2QyVGxWOUJSVThrNzhkZmNJSmxjMkNiTDFwTXpWaTBrVFRDUEZZOGNJVkQ2SkV5ZEU0enBPMlBEVUN2eG0rXG5RVlFLNXNiWW9YQm1ycGdrbVViNGlvND1cbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BiaXRld2lzZS05My5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMDgyMzc2OTAyMjk4ODMwMDQ3MjgiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwYml0ZXdpc2UtOTMuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K";

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

  const embeddedB64 = EMBEDDED_SERVICE_ACCOUNT_B64?.trim();
  if (embeddedB64) {
    try {
      const decoded = Buffer.from(embeddedB64, "base64").toString("utf8");
      const parsed = massagePrivateKey(JSON.parse(decoded) as ServiceAccountLike);
      log.warn("using embedded service account fallback; set FIREBASE_SERVICE_ACCOUNT_JSON_* for prod");
      return parsed as ServiceAccount;
    } catch (err) {
      log.error({ err }, "embedded service account decode failed");
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

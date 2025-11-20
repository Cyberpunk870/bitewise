// backend-lib/backend-api/webauthn.ts
import { Router, type Request, type Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import logger from "../lib/logger";
import { ensureAdmin } from "../lib/firebaseAdmin";
import { verifyAuth } from "../middleware/verifyAuth";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

const router = Router();
const log = logger.child({ module: "webauthn" });

type ChallengeType = "registration" | "authentication";

interface StoredPasskey {
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType?: string | null;
  backedUp?: boolean | null;
  transports?: string[];
  label?: string;
  userAgent?: string;
  created_at?: string;
  last_used_at?: string;
}

const PASSKEY_COLLECTION = "passkeys";
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_RP_NAME = process.env.WEBAUTHN_RP_NAME || "BiteWise";
const DEFAULT_RP_ID =
  process.env.WEBAUTHN_RP_ID ||
  (process.env.VERCEL_URL ? process.env.VERCEL_URL.replace(/^https?:\/\//, "") : "localhost");

const originEnv =
  process.env.WEBAUTHN_ALLOWED_ORIGINS ||
  process.env.CLIENT_ORIGINS ||
  "";
const envOrigins = originEnv
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const fallbackOrigins = [
  process.env.WEBAUTHN_APP_ORIGIN,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  DEFAULT_RP_ID && DEFAULT_RP_ID !== "localhost" ? `https://${DEFAULT_RP_ID}` : null,
  "https://bitewise.vercel.app",
  "https://bitewise-five.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean) as string[];

const EXPECTED_ORIGINS = Array.from(new Set([...envOrigins, ...fallbackOrigins]));

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function sanitizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, "");
}

async function ensureUserForPhone(phone: string) {
  ensureAdmin();
  const db = getFirestore();
  const snap = await db.collection("users").where("phone", "==", phone).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, data: doc.data() || {} };
}

async function getPasskeys(uid: string): Promise<Array<StoredPasskey & { id: string }>> {
  const db = getFirestore();
  const snap = await db.collection("users").doc(uid).collection(PASSKEY_COLLECTION).get();
  return snap.docs.map((doc) => ({ ...(doc.data() as StoredPasskey), id: doc.id }));
}

async function setChallenge(uid: string, type: ChallengeType, challenge: string) {
  const db = getFirestore();
  const now = new Date().toISOString();
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        webauthnChallenge: challenge,
        webauthnChallengeType: type,
        webauthnChallengeAt: now,
      },
      { merge: true }
    );
}

async function getChallenge(uid: string) {
  const db = getFirestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const challenge = typeof data.webauthnChallenge === "string" ? data.webauthnChallenge : null;
  const type = data.webauthnChallengeType as ChallengeType | undefined;
  const ts = typeof data.webauthnChallengeAt === "string" ? data.webauthnChallengeAt : null;
  return { challenge, type, ts, doc: snap };
}

async function clearChallenge(uid: string) {
  const db = getFirestore();
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        webauthnChallenge: null,
        webauthnChallengeType: null,
        webauthnChallengeAt: null,
      },
      { merge: true }
    );
}

function challengeFresh(ts: string | null): boolean {
  if (!ts) return false;
  const age = Date.now() - new Date(ts).getTime();
  return age >= 0 && age <= CHALLENGE_MAX_AGE_MS;
}

function toCredentialDescriptor(pk: StoredPasskey) {
  return {
    id: pk.credentialId,
    transports: pk.transports as AuthenticatorTransportFuture[] | undefined,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function passkeyResponse(pkDoc: StoredPasskey & { id: string }) {
  return {
    id: pkDoc.id,
    label: pkDoc.label || pkDoc.deviceType || "Passkey",
    deviceType: pkDoc.deviceType,
    backedUp: pkDoc.backedUp,
    createdAt: pkDoc.created_at,
    lastUsedAt: pkDoc.last_used_at,
  };
}

function ensureOrigins(): string[] {
  if (!EXPECTED_ORIGINS.length) {
    return ["http://localhost:5173"];
  }
  return EXPECTED_ORIGINS;
}

/* -------------------- Authenticated routes (requires Firebase ID token) -------------------- */

router.get("/passkeys", verifyAuth, async (req: Request, res: Response) => {
  const timeoutMs = 7000;
  const started = Date.now();
  try {
    const uid = (req as any).user?.uid || (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    log.info({ uid, route: "passkeys", phase: "start" }, "passkeys request");
    ensureAdmin();
    const passkeys = await withTimeout(getPasskeys(uid), timeoutMs, "getPasskeys");
    const sorted = passkeys.sort((a, b) => {
      const aTs = a.last_used_at || a.created_at || "";
      const bTs = b.last_used_at || b.created_at || "";
      return aTs > bTs ? -1 : 1;
    });
    log.info(
      { uid, route: "passkeys", count: sorted.length, ms: Date.now() - started },
      "passkeys ok"
    );
    return res.json({ ok: true, passkeys: sorted.map(passkeyResponse) });
  } catch (err: any) {
    log.error(
      { err, route: "passkeys", ms: Date.now() - started },
      "GET /passkeys failed"
    );
    const isTimeout = err?.message?.toString().includes("timeout");
    return res
      .status(isTimeout ? 504 : 500)
      .json({ ok: false, error: err?.message || "internal error" });
  }
});

router.delete("/passkeys/:id", verifyAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "id required" });
    ensureAdmin();
    const db = getFirestore();
    await db.collection("users").doc(uid).collection(PASSKEY_COLLECTION).doc(id).delete();
    return res.json({ ok: true });
  } catch (err: any) {
    log.error({ err }, "DELETE /passkeys/:id failed");
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

router.post("/register/options", verifyAuth, async (req: Request, res: Response) => {
  const timeoutMs = 7000;
  const started = Date.now();
  try {
    const uid = (req as any).user?.uid || (req as any).uid;
    const userName = (req as any).user?.name || "";
    const phone = (req as any).user?.phone || "";
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    log.info({ uid, route: "register/options", phase: "start" }, "passkey options request");
    ensureAdmin();
    const passkeys = await withTimeout(getPasskeys(uid), timeoutMs, "getPasskeys");

    const options = await generateRegistrationOptions({
      rpName: DEFAULT_RP_NAME,
      rpID: DEFAULT_RP_ID,
      userID: uid,
      userName: phone || userName || `uid-${uid.slice(0, 6)}`,
      userDisplayName: userName || phone || uid,
      timeout: 60_000,
      attestationType: "none",
      excludeCredentials: passkeys.map(toCredentialDescriptor),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await setChallenge(uid, "registration", options.challenge);
    log.info(
      { uid, route: "register/options", ms: Date.now() - started, passkeys: passkeys.length },
      "registration options ok"
    );
    return res.json({ ok: true, options });
  } catch (err: any) {
    log.error(
      { err, route: "register/options", ms: Date.now() - started },
      "register/options failed"
    );
    const isTimeout = err?.message?.toString().includes("timeout");
    return res
      .status(isTimeout ? 504 : 500)
      .json({ ok: false, error: err?.message || "internal error" });
  }
});

router.post("/register/verify", verifyAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const credential = req.body?.credential as RegistrationResponseJSON | undefined;
    if (!credential) {
      return res.status(400).json({ ok: false, error: "credential required" });
    }

    ensureAdmin();
    const pending = await getChallenge(uid);
    if (!pending?.challenge || pending.type !== "registration" || !challengeFresh(pending.ts)) {
      return res.status(400).json({ ok: false, error: "no valid registration challenge" });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin: ensureOrigins(),
      expectedRPID: DEFAULT_RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ ok: false, error: "registration verification failed" });
    }

    const {
      credential: verifiedCredential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;
    const id = verifiedCredential.id;
    const now = nowIso();
    const db = getFirestore();
    const label =
      typeof req.body?.client?.label === "string"
        ? req.body.client.label.slice(0, 120)
        : undefined;
    const userAgent =
      typeof req.body?.client?.userAgent === "string"
        ? req.body.client.userAgent.slice(0, 200)
        : undefined;

    await db
      .collection("users")
      .doc(uid)
      .collection(PASSKEY_COLLECTION)
      .doc(id)
      .set(
        {
          credentialId: id,
          publicKey: Buffer.from(verifiedCredential.publicKey).toString("base64url"),
          counter: verifiedCredential.counter || 0,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: credential.response?.transports,
          label,
          userAgent,
          created_at: now,
          last_used_at: now,
        },
        { merge: true }
      );

    await clearChallenge(uid);

    return res.json({ ok: true, passkey: { id, label: label || credentialDeviceType } });
  } catch (err: any) {
    log.error({ err }, "register/verify failed");
    const msg = err?.message?.includes("was not set in the registration ceremony")
      ? "challenge mismatch"
      : err?.message || "internal error";
    return res.status(400).json({ ok: false, error: msg });
  }
});

/* -------------------- Public routes (used before Firebase auth is available) -------------------- */

router.post("/authenticate/options", async (req: Request, res: Response) => {
  try {
    const rawPhone = typeof req.body?.phone === "string" ? req.body.phone : "";
    const phone = sanitizePhone(rawPhone);
    if (!phone) return res.status(400).json({ ok: false, error: "phone required" });

    const user = await ensureUserForPhone(phone);
    if (!user) return res.status(404).json({ ok: false, error: "no user for phone" });

    const passkeys = await getPasskeys(user.uid);
    if (!passkeys.length) {
      return res.status(404).json({ ok: false, error: "no passkeys registered for this account" });
    }

    const options = await generateAuthenticationOptions({
      rpID: DEFAULT_RP_ID,
      timeout: 60_000,
      userVerification: "preferred",
      allowCredentials: passkeys.map(toCredentialDescriptor),
    });

    await setChallenge(user.uid, "authentication", options.challenge);

    return res.json({ ok: true, options });
  } catch (err: any) {
    log.error({ err }, "authenticate/options failed");
    return res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

router.post("/authenticate/verify", async (req: Request, res: Response) => {
  try {
    const rawPhone = typeof req.body?.phone === "string" ? req.body.phone : "";
    const phone = sanitizePhone(rawPhone);
    if (!phone) return res.status(400).json({ ok: false, error: "phone required" });

    const credential = req.body?.credential as AuthenticationResponseJSON | undefined;
    if (!credential) {
      return res.status(400).json({ ok: false, error: "credential required" });
    }

    const user = await ensureUserForPhone(phone);
    if (!user) return res.status(404).json({ ok: false, error: "no user for phone" });

    const pending = await getChallenge(user.uid);
    if (
      !pending?.challenge ||
      pending.type !== "authentication" ||
      !challengeFresh(pending.ts)
    ) {
      return res.status(400).json({ ok: false, error: "no valid authentication challenge" });
    }

    const credentialId = credential.id;
    const db = getFirestore();
    const passkeySnap = await db
      .collection("users")
      .doc(user.uid)
      .collection(PASSKEY_COLLECTION)
      .doc(credentialId)
      .get();

    if (!passkeySnap.exists) {
      return res.status(404).json({ ok: false, error: "passkey not registered" });
    }

    const stored = passkeySnap.data() as StoredPasskey;
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin: ensureOrigins(),
      expectedRPID: DEFAULT_RP_ID,
      credential: {
        id: stored.credentialId,
        publicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: stored.counter || 0,
        transports: stored.transports as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return res.status(400).json({ ok: false, error: "authentication failed" });
    }

    const { newCounter } = verification.authenticationInfo;
    await passkeySnap.ref.set(
      { counter: newCounter, last_used_at: nowIso() },
      { merge: true }
    );
    await clearChallenge(user.uid);

    const adminAuth = getAdminAuth();
    const token = await adminAuth.createCustomToken(user.uid, { phone });
    return res.json({ ok: true, token });
  } catch (err: any) {
    log.error({ err }, "authenticate/verify failed");
    const status = err?.message?.includes("challenge") ? 400 : 500;
    return res.status(status).json({ ok: false, error: err?.message || "internal error" });
  }
});

export default router;

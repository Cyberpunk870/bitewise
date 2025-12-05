// backend-lib/middleware/verifyAuth.ts
import { Request, Response, NextFunction } from "express";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import logger from "../lib/logger";
import { ensureAdmin } from "../lib/firebaseAdmin";

const log = logger.child({ module: "verifyAuth" });

export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Allow admin shared secret to bypass Firebase verification (for server-to-server scripts).
    const adminSecret = process.env.ADMIN_SHARED_SECRET;
    const headerSecret = typeof req.headers["x-admin-secret"] === "string" ? req.headers["x-admin-secret"] : null;
    if (adminSecret && headerSecret && headerSecret === adminSecret) {
      (req as any).user = { uid: "admin-shared-secret" };
      (req as any).auth = { admin: true };
      return next();
    }

    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);

    if (!match || !match[1]) {
      log.warn("Missing or invalid auth token");
      return res.status(401).json({ ok: false, error: "missing or invalid auth token" });
    }

    const idToken = match[1];
    ensureAdmin();
    const adminAuth = getAdminAuth();
    const timeoutMs = 5000;
    const decoded = (await Promise.race([
      adminAuth.verifyIdToken(idToken, false),
      new Promise((_res, rej) => setTimeout(() => rej(new Error("verifyIdToken timeout")), timeoutMs)),
    ])) as import("firebase-admin/auth").DecodedIdToken;

    // ✅ Attach user object (not just uid)
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name
    };
    (req as any).auth = decoded;

    next();
  } catch (err: any) {
    const code = err?.code || err?.message || "unauthorized";
    log.error({ err, code }, "Auth error");
    return res.status(401).json({ ok: false, error: String(code) });
  }
}

export function requireAdminAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const claims = (req as any).auth as import("firebase-admin/auth").DecodedIdToken | undefined;
    const hasClaim = claims?.admin === true;
    if (hasClaim) return next();

    const adminSecret = process.env.ADMIN_SHARED_SECRET;
    const headerSecret = typeof req.headers["x-admin-secret"] === "string" ? req.headers["x-admin-secret"] : null;
    if (adminSecret && headerSecret === adminSecret) return next();

    log.warn(
      { uid: (req as any).user?.uid, hasClaim, hasSecret: Boolean(headerSecret) },
      "admin access denied"
    );
    return res.status(403).json({ ok: false, error: "admin access required" });
  } catch (err: any) {
    log.error({ err }, "requireAdminAccess error");
    return res.status(403).json({ ok: false, error: "admin access required" });
  }
}

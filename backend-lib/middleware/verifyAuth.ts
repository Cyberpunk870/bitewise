// backend-lib/middleware/verifyAuth.ts
import { Request, Response, NextFunction } from "express";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import logger from "../lib/logger";
import { ensureAdmin } from "../lib/firebaseAdmin";

const log = logger.child({ module: "verifyAuth" });

export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);

    if (!match || !match[1]) {
      log.warn("Missing or invalid auth token");
      return res.status(401).json({ ok: false, error: "missing or invalid auth token" });
    }

    const idToken = match[1];
    ensureAdmin();
    const adminAuth = getAdminAuth();
    const timeoutMs = 8000;
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

    next();
  } catch (err: any) {
    const code = err?.code || err?.message || "unauthorized";
    log.error({ err, code }, "Auth error");
    return res.status(401).json({ ok: false, error: String(code) });
  }
}

// backend-lib/middleware/verifyAuth.ts
import { Request, Response, NextFunction } from "express";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);

    if (!match || !match[1]) {
      console.warn("[verifyAuth] Missing or invalid auth token");
      return res.status(401).json({ ok: false, error: "missing or invalid auth token" });
    }

    const idToken = match[1];
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken, true);

    // ✅ Attach user object (not just uid)
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (err: any) {
    console.error("[verifyAuth] Auth error:", err?.message || err);
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
}
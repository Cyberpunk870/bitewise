// bitewise/server/middleware/verifyAuth.ts
import { Request, Response, NextFunction } from "express";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authz = req.headers.authorization || "";
    const match = authz.match(/^Bearer (.+)$/i);
    const idToken = match ? match[1] : "";

    if (!idToken) {
      return res
        .status(401)
        .json({ ok: false, error: "missing auth token" });
    }

    // Verify Firebase ID token using Admin SDK
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken, true);

    // Attach UID for downstream handlers
    (req as any).uid = decoded.uid;

    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized" });
  }
}
// bitewise/types/express/index.d.ts

import type { UserRecord } from "firebase-admin/auth";

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
        firebaseUser?: UserRecord;
      };
    }
  }
}

export {};
// src/hooks/authReady.ts
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

let firstEmission: Promise<User | null> | null = null;

export function waitForAuthInit(): Promise<User | null> {
  if (!firstEmission) {
    firstEmission = new Promise<User | null>((resolve) => {
      const unsub = onAuthStateChanged(getAuth(), (u) => {
        unsub();
        resolve(u); // may be null if signed out
      });
    });
  }
  return firstEmission;
}

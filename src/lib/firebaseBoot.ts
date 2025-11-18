// src/lib/firebaseBoot.ts
// Centralized helper to kick off the heavy Firebase bundle exactly once.
// Screens that need Auth immediately (onboarding, unlock) can call this
// without paying the cost on every navigation.

type FirebaseModule = typeof import('./firebase');

let firebasePromise: Promise<FirebaseModule> | null = null;

export function ensureFirebaseBoot(): Promise<FirebaseModule> {
  if (!firebasePromise) {
    firebasePromise = import('./firebase');
  }
  return firebasePromise;
}

export function isFirebaseBooted() {
  return firebasePromise !== null;
}

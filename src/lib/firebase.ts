// src/lib/firebase.ts
// Firebase init with Firestore streaming disabled by default (REST-first),
// phone OTP helpers, and safe session persistence + auth readiness utilities.

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { setActivePhone, upsertUser } from "./profileStore";

// read once here so everything else can branch on it
const USE_CLOUD = import.meta.env.VITE_USE_FIRESTORE === "1";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  // measurementId is optional; only present if Analytics is enabled
  ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    ? { measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID }
    : {}),
};

export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Be explicit about persistence (default is usually local; we lock it in)
setPersistence(auth, browserLocalPersistence).catch(() => {});

let analyticsBootPromise: Promise<void> | null = null;
let analyticsScheduled = false;

async function bootAnalytics() {
  try {
    const supported = await isSupported();
    if (supported) {
      getAnalytics(app);
    }
  } catch {
    /* ignore analytics init failures */
  }
}

export function ensureAnalyticsBoot(): Promise<void> {
  if (!analyticsBootPromise) {
    analyticsBootPromise = bootAnalytics();
  }
  return analyticsBootPromise;
}

function scheduleAnalyticsBoot() {
  if (typeof window === "undefined" || analyticsScheduled) return;
  analyticsScheduled = true;

  let idleHandle: ReturnType<typeof setTimeout> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const removers: Array<() => void> = [];

  const cleanup = () => {
    while (removers.length) {
      try {
        const fn = removers.pop();
        fn && fn();
      } catch {
        /* ignore */
      }
    }
    if (idleHandle != null) {
      if ("cancelIdleCallback" in window && typeof (window as any).cancelIdleCallback === "function") {
        (window as any).cancelIdleCallback(idleHandle);
      } else {
        window.clearTimeout(idleHandle);
      }
      idleHandle = null;
    }
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const trigger = () => {
    cleanup();
    if ("requestIdleCallback" in window) {
      idleHandle = (window as any).requestIdleCallback(
        () => {
          idleHandle = null;
          void ensureAnalyticsBoot();
        },
        { timeout: 2500 }
      );
    } else {
      timer = setTimeout(() => {
        timer = null;
        void ensureAnalyticsBoot();
      }, 1600);
    }
  };

  const add = (
    name: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions
  ) => {
    window.addEventListener(name, handler as any, options);
    removers.push(() => window.removeEventListener(name, handler as any, options));
  };

  const onInteract = () => trigger();
  add("pointerdown", onInteract, { once: true, passive: true });
  add("keydown", onInteract, { once: true });
  add("scroll", onInteract, { once: true, passive: true });
  add(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") {
        trigger();
      }
    },
    { once: true }
  );

  timer = setTimeout(() => {
    trigger();
  }, 5000);
}

if (typeof window !== "undefined") {
  scheduleAnalyticsBoot();
}

// 🔒 Only initialize Firestore plumbing if cloud is enabled.
//     Use a dynamic import to avoid loading the Firestore SDK at all otherwise.
(async () => {
  if (!USE_CLOUD) return;
  try {
    const { initializeFirestore } = await import("firebase/firestore");
    initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    } as any);
  } catch {
    /* noop */
  }
})();

/* -------------------------------------------------------------------------- */
/*                                Auth readiness                              */
/* -------------------------------------------------------------------------- */

/**
 * A single promise that resolves after the FIRST auth state emission
 * (either a signed-in user or `null`), so you can await before calling
 * protected APIs.
 */
let _authReadyResolve: ((u: User | null) => void) | null = null;
export const authReady: Promise<User | null> = new Promise((resolve) => {
  _authReadyResolve = resolve;
});

// Wire once: resolve the promise on first emission, keep listening for app logic.
let _firstEmission = true;
onAuthStateChanged(auth, (user) => {
  try {
    if (_firstEmission) {
      _firstEmission = false;
      _authReadyResolve?.(user ?? null);
      _authReadyResolve = null;
    }
    // optional: broadcast to app (guards, header, etc.)
    window.dispatchEvent(new Event("bw:auth:changed"));
  } catch {}
});

/** Run a callback once Firebase Auth has settled (signed in or out). */
export async function onAuthReady(cb: (user: User | null) => void | Promise<void>) {
  const user = await authReady;
  await cb(user);
}

/** Returns the current user after Auth is ready (may be `null` if signed out). */
export async function getAuthReadyUser(): Promise<User | null> {
  return await authReady;
}

/** Get a fresh ID token (or null if signed out). */
export async function getFreshIdToken(): Promise<string | null> {
  const user = auth.currentUser ?? (await authReady);
  if (!user) return null;
  try {
    return await user.getIdToken(/* forceRefresh */ false);
  } catch {
    return null;
  }
}

/** Same as getFreshIdToken but throws if the user is not signed in. */
export async function requireIdToken(): Promise<string> {
  const tok = await getFreshIdToken();
  if (!tok) throw new Error("Not authenticated");
  return tok;
}

/* ---------------- reCAPTCHA (stable, invisible) ---------------- */

declare global {
  interface Window {
    _bwRecaptcha?: RecaptchaVerifier | null;
    grecaptcha?: any;
    confirmationResult?: ConfirmationResult;
    bwAuth?: typeof auth;
  }
}

/**
 * Create or reuse a single invisible reCAPTCHA verifier.
 * Safe across route changes/HMR and avoids "already rendered" errors.
 */
export function ensureRecaptcha(containerId = "recaptcha-container"): RecaptchaVerifier {
  const w = window as any;

  // Reuse if we already have one
  if (w._bwRecaptcha instanceof RecaptchaVerifier) {
    return w._bwRecaptcha as RecaptchaVerifier;
  }

  // Ensure container exists (off-screen)
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement("div");
    el.id = containerId;
    el.style.position = "fixed";
    el.style.left = "-99999px";
    el.style.top = "0";
    document.body.appendChild(el);
  } else {
    try { el.innerHTML = ""; } catch {}
  }

  // v10 signature: new RecaptchaVerifier(auth, containerOrId, params)
  const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });

  // Render defensively – ignore "already rendered" errors
  try { (verifier as any).render?.(); } catch {}

  w._bwRecaptcha = verifier;
  return verifier;
}

/** Clear the current verifier and its DOM, if any. */
export function clearRecaptcha(containerId = "recaptcha-container") {
  const w = window as any;
  try { w._bwRecaptcha?.clear?.(); } catch {}
  w._bwRecaptcha = null;

  const el = document.getElementById(containerId);
  if (el) {
    try { el.innerHTML = ""; } catch {}
  }

  // If the SDK left a global grecaptcha widget, reset it (best effort).
  try { w.grecaptcha?.reset?.(); } catch {}
}

/* ---------------- OTP helpers ---------------- */

export async function sendOtp(phoneE164: string): Promise<ConfirmationResult> {
  const verifier = ensureRecaptcha(); // idempotent
  const result = await signInWithPhoneNumber(auth, phoneE164, verifier);
  (window as any).confirmationResult = result;
  return result;
}

export async function confirmOtp(code: string) {
  const w = window as any;
  const pending: ConfirmationResult | undefined = w.confirmationResult;
  if (!pending) throw new Error("No pending OTP session. Please request a code again.");

  const cred = await pending.confirm(code);

  // Persist a tiny mirror for app guards (optional)
  try {
    const payload = {
      uid: cred.user.uid,
      phone: cred.user.phoneNumber ?? null,
      ts: Date.now(),
    };
    localStorage.setItem("bw_session", JSON.stringify(payload));
    if (payload.phone) sessionStorage.setItem("bw.session.phone", payload.phone);
    if (payload.phone) {
      try {
        setActivePhone(payload.phone);
        upsertUser({
          phone: payload.phone,
          name: cred.user.displayName || "Guest",
        } as any);
      } catch {}
    }
  } catch {}

  // Wait until Firebase emits the post-sign-in state
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });

  // Let the app react (AppShell listens for this)
  try {
    window.dispatchEvent(new Event("bw:auth:changed"));
  } catch {}

  return cred.user;
}

export function clearPhoneSession() {
  try { clearRecaptcha(); } catch {}
  const w = window as any;
  delete w.confirmationResult;
}

/** Resolves after the first auth state emission (signed-in or out). */
export async function waitForAuthSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
}

/** Similar to waitForAuthSettle but returns the current user */
export async function waitForAuthInit():
Promise<User | null> {
  return await new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

// keep existing alias used in your codebase
export { confirmOtp as confirmPhoneCode };

// quick dev handle + debug helper exposed on window for console use
if (typeof window !== "undefined") {
  try {
    (window as any).bwAuth = auth;
    (window as any).__bwGetIdToken = async () => {
      try {
        return await auth.currentUser?.getIdToken();
      } catch {
        return null;
      }
    };
  } catch {
    /* ignore */
  }
}

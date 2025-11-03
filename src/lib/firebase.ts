/// src/lib/firebase.ts
// Firebase init with Firestore streaming disabled by default (REST-first),
// phone OTP helpers, and safe session persistence.

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  onAuthStateChanged,
} from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

// read once here so everything else can branch on it
const USE_CLOUD = import.meta.env.VITE_USE_FIRESTORE === '1';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 🔒 Only initialize Firestore plumbing if cloud is enabled.
//     Use a dynamic import to avoid loading the Firestore SDK at all otherwise.
(async () => {
  if (!USE_CLOUD) return;
  try {
    const { initializeFirestore } = await import('firebase/firestore');
    // Cast options to any to appease TS for non-public flags.
    initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
      preferRest: true as any,
    } as any);
  } catch { /* noop */ }
})();

// Optional analytics (no-op if unsupported)
isSupported().then((ok) => ok && getAnalytics(app)).catch(() => {});

/* ---------------- reCAPTCHA (stable, invisible) ---------------- */

declare global {
  interface Window {
    _bwRecaptcha?: RecaptchaVerifier | null;
    grecaptcha?: any;
  }
}

/**
 * Create or reuse a single invisible reCAPTCHA verifier.
 * Safe across route changes/HMR and avoids "already rendered" errors.
 */
export function ensureRecaptcha(containerId = 'recaptcha-container'): RecaptchaVerifier {
  const w = window as any;
  const _auth = getAuth();

  // Reuse if we already have one
  if (w._bwRecaptcha instanceof RecaptchaVerifier) {
    return w._bwRecaptcha as RecaptchaVerifier;
  }

  // Ensure container exists (off-screen) and is clean
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    el.style.position = 'fixed';
    el.style.left = '-99999px';
    el.style.top = '0';
    document.body.appendChild(el);
  } else {
    try { el.innerHTML = ''; } catch {}
  }

  const verifier = new RecaptchaVerifier(_auth, el, { size: 'invisible' });

  // Render defensively – ignore "already rendered" errors
  try { (verifier as any).render?.(); } catch {}

  w._bwRecaptcha = verifier;
  return verifier;
}

/** Clear the current verifier and its DOM, if any. */
export function clearRecaptcha(containerId = 'recaptcha-container') {
  const w = window as any;
  try { w._bwRecaptcha?.clear?.(); } catch {}
  w._bwRecaptcha = null;

  const el = document.getElementById(containerId);
  if (el) {
    try { el.innerHTML = ''; } catch {}
  }

  // If the SDK left a global grecaptcha widget, reset it (best effort).
  try { w.grecaptcha?.reset?.(); } catch {}
}

/* ---------------- OTP helpers ---------------- */

export async function sendOtp(phoneE164: string): Promise<ConfirmationResult> {
  const verifier = ensureRecaptcha(); // idempotent
  const result = await signInWithPhoneNumber(getAuth(), phoneE164, verifier);
  (window as any).confirmationResult = result;
  return result;
}

export async function confirmOtp(code: string) {
  const w = window as any;
  const pending: ConfirmationResult | undefined = w.confirmationResult;
  if (!pending) throw new Error('No pending OTP session. Please request a code again.');

  const cred = await pending.confirm(code);

  try {
    const payload = {
      uid: cred.user.uid,
      phone: cred.user.phoneNumber ?? null,
      ts: Date.now(),
    };
    localStorage.setItem('bw_session', JSON.stringify(payload));
    // mirror to sessionStorage for guards/routers that read this directly
    if (payload.phone) sessionStorage.setItem('bw.session.phone', payload.phone);
  } catch {}

  await waitForAuthSettle();

  // Let the app react (AppShell listens for this)
  try { window.dispatchEvent(new Event('bw:auth:changed')); } catch {}

  return cred.user;
}

export function clearPhoneSession() {
  try { clearRecaptcha(); } catch {}
  const w = window as any;
  delete w.confirmationResult;
}

export async function waitForAuthSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
}

// keep existing alias used in your codebase
export { confirmOtp as confirmPhoneCode };
try { (window as any).bwAuth = auth; } catch{}

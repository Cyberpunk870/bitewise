// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  onAuthStateChanged,
} from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

// --- Firebase app init (use your VITE_* vars) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Optional analytics (no-op if unsupported)
isSupported().then((ok) => ok && getAnalytics(app)).catch(() => {});

// --- reCAPTCHA helper (invisible) ---
export function ensureRecaptcha(containerId = 'recaptcha-container') {
  const w = window as any;
  if (w.recaptchaVerifier) return w.recaptchaVerifier as RecaptchaVerifier;

  // ensure a container exists (hidden)
  const el =
    document.getElementById(containerId) ||
    ((): HTMLDivElement => {
      const d = document.createElement('div');
      d.id = containerId;
      d.style.display = 'none';
      document.body.appendChild(d);
      return d;
    })();

  // create invisible verifier
  w.recaptchaVerifier = new RecaptchaVerifier(auth, el, { size: 'invisible' });
  return w.recaptchaVerifier as RecaptchaVerifier;
}

// --- Send OTP using Firebase Auth ---
// NOTE: exported name is exactly `sendOtp`
export async function sendOtp(phoneE164: string): Promise<ConfirmationResult> {
  const verifier = ensureRecaptcha();
  const result = await signInWithPhoneNumber(auth, phoneE164, verifier);
  // stash for OTP screen (optional but convenient)
  (window as any).confirmationResult = result;
  return result;
}

// --- Confirm OTP code & create / restore session ---
export async function confirmOtp(code: string) {
  const w = window as any;
  const pending: ConfirmationResult | undefined = w.confirmationResult;
  if (!pending) throw new Error('No pending OTP session. Please request a code again.');

  const cred = await pending.confirm(code);
  // you can put any session payload you want here
  try {
    const payload = {
      uid: cred.user.uid,
      phone: cred.user.phoneNumber ?? null,
      ts: Date.now(),
    };
    localStorage.setItem('bw_session', JSON.stringify(payload));
  } catch {
    /* ignore storage errors */
  }
  await waitForAuthSettle();
  return cred.user;
}

// --- Clear any stale phone session (useful before retry) ---
export function clearPhoneSession() {
  const w = window as any;
  try {
    if (w.recaptchaVerifier && typeof w.recaptchaVerifier.clear === 'function') {
      w.recaptchaVerifier.clear();
    }
  } catch {}
  delete w.recaptchaVerifier;
  delete w.confirmationResult;
}

// --- Wait until Firebase auth state has settled after confirming OTP ---
export async function waitForAuthSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
}

export { confirmOtp as confirmPhoneCode };

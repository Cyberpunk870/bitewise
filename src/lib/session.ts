// src/lib/session.ts
import type { AddressLabel } from '../store/address';

/** What we keep in session (ephemeral, per tab) */
export type SessionUser = {
  uid: string;
  phone: string;
  name?: string;
  addressLine?: string;
  label?: AddressLabel | null;
  lat?: number;
  lng?: number;
};

const KEY_USER = 'bw.session.user.v1';
const KEY_PHONE = 'bw.session.phone';           // used across the app already
const KEY_LOGOUT_REASON = 'bw.logoutReason';    // 'idle' | 'manual' | 'other' | ''
const KEY_LAST_PHONE = 'bw.lastPhone';

/* ---------------------- Basic session helpers ----------------------- */

export function saveSession(u: SessionUser) {
  try {
    sessionStorage.setItem(KEY_USER, JSON.stringify(u));
    if (u.phone) sessionStorage.setItem(KEY_PHONE, u.phone);
  } catch {}
}

export function loadSession(): SessionUser | undefined {
  try {
    const raw = sessionStorage.getItem(KEY_USER);
    return raw ? (JSON.parse(raw) as SessionUser) : undefined;
  } catch {
    return undefined;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY_USER);
    sessionStorage.removeItem(KEY_PHONE);
  } catch {}
}

/* ----------------------- Logout reason helpers ---------------------- */

export type LogoutReason = 'idle' | 'manual' | 'other' | '';

export function setLogoutReason(r: LogoutReason) {
  try {
    sessionStorage.setItem(KEY_LOGOUT_REASON, r);
  } catch {}
}

export function getLogoutReason(): LogoutReason {
  try {
    return (sessionStorage.getItem(KEY_LOGOUT_REASON) as LogoutReason) || '';
  } catch {
    return '';
  }
}

/* ------------------------ Idle watcher (1m) ------------------------- */

let idleTimer: ReturnType<typeof setTimeout> | null = null;

export function initIdleSessionWatcher(options?: { minutes?: number }) {
  const minutes =
    typeof options?.minutes === 'number'
      ? options.minutes
      : Number((import.meta as any).env?.VITE_IDLE_MINUTES ?? 1);

  const IDLE_MS = Math.max(0.2, minutes) * 60 * 1000; // clamp to >=12s

  const reset = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(onIdle, IDLE_MS);
  };

  const onIdle = () => {
    try {
      // persist last phone for quick passkey on Unlock
      const phone = sessionStorage.getItem(KEY_PHONE) || loadSession()?.phone || '';
      if (phone) localStorage.setItem(KEY_LAST_PHONE, phone);

      setLogoutReason('idle');
      clearSession();
    } finally {
      // simple hard redirect to Unlock
      window.location.href = '/unlock';
    }
  };

  const onActivity = () => {
    // Only reset when tab is visible to avoid fighting background timers
    if (document.visibilityState === 'visible') reset();
  };

  // start immediately and attach listeners
  reset();

  const opts: AddEventListenerOptions = { passive: true };
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll', 'pointerdown', 'wheel', 'visibilitychange'].forEach(
    (evt) => {
      window.addEventListener(evt, () => {
        if (evt === 'visibilitychange' && document.visibilityState !== 'visible') return;
        reset();
      }, opts);
    }
  );
}

export function stopIdleSessionWatcher() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/* -------------------- Manual logout (use this!) --------------------- */
/** Call this from any logout button/menu. Do NOT call clearSession() directly. */
// DO NOT call clearSession() directly from UI.
// Use this instead.
export function manualLogout(opts?: { navigate?: (path: string) => void }) {
  try {
    // Remember last phone so PasskeyLogin can prefill
    const phone = sessionStorage.getItem('bw.session.phone') || loadSession()?.phone || '';
    if (phone) localStorage.setItem('bw.lastPhone', phone);
  } catch {}

  // Set reason for guards
  setLogoutReason('manual');

  // Redirect to phone login in "login" mode
  if (opts?.navigate) {
    opts.navigate('/onboarding/auth/phone?mode=login');
  } else if (typeof window !== 'undefined') {
    window.location.href = '/onboarding/auth/phone?mode=login';
  }

  // 🔑 Clear ephemeral session *after* navigation begins
  setTimeout(() => {
    clearSession();
  }, 0);
}

/* Utility: keep last phone without logging out (optional elsewhere) */
export function rememberLastPhoneFromSession() {
  try {
    const phone = sessionStorage.getItem(KEY_PHONE) || loadSession()?.phone || '';
    if (phone) localStorage.setItem(KEY_LAST_PHONE, phone);
  } catch {}
}

// src/lib/session.ts
import type { AddressLabel } from '../store/address';
import { getAuth, signOut } from 'firebase/auth';

// What we keep in session (ephemeral, per tab)
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
const KEY_PHONE = 'bw.session.phone';
const KEY_LOGOUT_REASON = 'bw.logoutReason'; // 'idle' | 'manual' | 'other' | ''
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
    sessionStorage.removeItem('bw.auth.verified');
  } catch {}
}

export function getLogoutReason(): LogoutReason {
  try {
    return (sessionStorage.getItem(KEY_LOGOUT_REASON) as LogoutReason) || '';
  } catch {
    return '';
  }
}

/* ------------------------ Shared signOut helper --------------------- */
/** Make sure Firebase auth is actually killed so ID token stops working */
async function doFirebaseSignOut() {
  try {
    await signOut(getAuth());
    // console.log('✅ Firebase signOut ran');
  } catch {
    // console.warn('⚠️ Firebase signOut failed', err);
  }
}

/* ------------------------ Idle watcher (1m) ------------------------- */

let idleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Starts watching for inactivity. On idle:
 *  - remember last phone
 *  - mark logoutReason=idle
 *  - sign out of Firebase (hard kill)
 *  - clear in-tab session
 *  - redirect to /unlock
 */
export function initIdleSessionWatcher(options?: { minutes?: number }) {
  const minutes =
    typeof options?.minutes === 'number'
      ? options.minutes
      : Number((import.meta as any).env?.VITE_IDLE_MINUTES ?? 1);

  const IDLE_MS = Math.max(0.2, minutes) * 60 * 1000; // clamp >= ~12s

  const onIdle = async () => {
    try {
      // remember last phone so Unlock can prefill
      const phone =
        sessionStorage.getItem(KEY_PHONE) ||
        loadSession()?.phone ||
        '';
      if (phone) {
        try {
          localStorage.setItem(KEY_LAST_PHONE, phone);
        } catch {}
      }

      // mark why we logged out
      setLogoutReason('idle');

      // HARD sign out of Firebase so backend tokens are invalidated
      await doFirebaseSignOut();

      // nuke in-tab session
      clearSession();

      // let listeners refresh UI state (headers, balances, etc.)
      try {
        window.dispatchEvent(new Event('bw:auth:changed'));
      } catch {}
    } finally {
      // hard redirect into lock screen
      window.location.href = '/unlock';
    }
  };

  const reset = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(onIdle, IDLE_MS);
  };

  const onActivity = () => {
    // Only reset when tab is visible; don't spam while backgrounded
    if (document.visibilityState === 'visible') reset();
  };

  // start immediately and attach listeners
  reset();
  const opts: AddEventListenerOptions = { passive: true };
  [
    'mousemove',
    'keydown',
    'click',
    'touchstart',
    'scroll',
    'pointerdown',
    'wheel',
    'visibilitychange',
  ].forEach((evt) => {
    window.addEventListener(
      evt,
      () => {
        if (
          evt === 'visibilitychange' &&
          document.visibilityState !== 'visible'
        )
          return;
        reset();
      },
      opts
    );
  });
}

export function stopIdleSessionWatcher() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/* -------------------- Manual logout (use this!) --------------------- */
/**
 * Call this from Settings → Logout button.
 * It duplicates the same cleanup as idle, but reason='manual'
 * and it navigates to phone login instead of /unlock.
 */
export async function manualLogout(opts?: { navigate?: (path: string) => void }) {
  try {
    // remember last phone for Unlock
    const phone =
      sessionStorage.getItem(KEY_PHONE) ||
      loadSession()?.phone ||
      '';
    if (phone) {
      try {
        localStorage.setItem(KEY_LAST_PHONE, phone);
      } catch {}
    }
  } catch {}

  // sign out from Firebase so API calls lose auth immediately
  await doFirebaseSignOut();

  // mark reason
  setLogoutReason('manual');

  // tell the app shell "auth changed"
  try {
    window.dispatchEvent(new Event('bw:auth:changed'));
  } catch {}

  // clear quick-unlock hints
  try {
    localStorage.removeItem('bw:hasPasskey');
    localStorage.removeItem('bw:lastUserName');
    localStorage.removeItem('bw:lastUserPhone');
  } catch {}

  // start navigation to login
  if (opts?.navigate) {
    opts.navigate('/onboarding/auth/phone?mode=login');
  } else if (typeof window !== 'undefined') {
    window.location.href = '/onboarding/auth/phone?mode=login';
  }

  // clear ephemeral session after nav begins
  setTimeout(() => {
    clearSession();
  }, 0);
}

/* Utility: keep last phone without logging out (optional elsewhere) */
export function rememberLastPhoneFromSession() {
  try {
    const phone =
      sessionStorage.getItem(KEY_PHONE) ||
      loadSession()?.phone ||
      '';
    if (phone) {
      localStorage.setItem(KEY_LAST_PHONE, phone);
    }
  } catch {}
}

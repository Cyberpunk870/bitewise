// src/lib/notify.ts
// Unified Firebase Cloud Messaging + Local Fallback notification helper for BiteWise

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/* ----------------------------- Constants ----------------------------- */
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY; // public Web Push key from Firebase
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/';
const LS_LAST_PUSH_TOKEN = 'bw.push.token';

/* ----------------------------- Firebase App ----------------------------- */
function getFirebaseApp() {
  if (getApps().length) return getApps()[0];
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
  return initializeApp(cfg);
}

/* ----------------------------- Permission helpers ----------------------------- */
export async function ensureNotifPermissionOrRoute(nav?: (path: string) => void) {
  if (!('Notification' in window)) return;
  const status = (Notification as any).permission;
  if (status === 'granted') return;
  if (status === 'denied') {
    if (nav) nav('/onboarding/perm/notifications');
    return;
  }
  try {
    await (Notification as any).requestPermission?.();
  } catch {}
}

function canUsePush(): boolean {
  try {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  } catch {
    return false;
  }
}

/* ----------------------------- Internal helper ----------------------------- */
async function postJSON(path: string, body: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = getAuth().currentUser;
  if (!user) throw new Error('not authed');
  const token = await user.getIdToken();
  headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) throw new Error(data?.error || res.statusText);
  return data;
}

/* ----------------------------- FCM registration ----------------------------- */
/**
 * Call after successful login/unlock (already done from AppShell).
 * - Requests permission (if not granted)
 * - Retrieves FCM token with VAPID key
 * - Registers token with backend if new/changed
 * - Falls back to local marker if FCM unsupported
 */
let inflightGetToken: Promise<string | null> | null = null;

export async function initOrRefreshPushOnAuth(phoneHint?: string) {
  try {
    if (!(await isSupported())) {
      // fallback: just mark local token so app can proceed
      try {
        localStorage.setItem(LS_LAST_PUSH_TOKEN, `local-${Date.now()}`);
      } catch {}
      return;
    }
  } catch {
    return;
  }

  const user = getAuth().currentUser;
  if (!user) return;

  // 1) Ask for permission
  try {
    await ensureNotifPermissionOrRoute();
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
  } catch {}

  // 2) Get FCM token (idempotent + retry-once)
  const app = getFirebaseApp();
  const messaging = getMessaging(app);

  if (!VAPID_KEY) {
    console.warn('[notify] Missing VITE_FCM_VAPID_KEY; push will not register.');
    return;
  }

  const doGet = async () => {
    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
  };

  try {
    inflightGetToken = inflightGetToken || doGet();
    let fcmToken = await inflightGetToken;
    inflightGetToken = null;

    // Retry once if transient AbortError
    if (!fcmToken) {
      await new Promise((r) => setTimeout(r, 800));
      fcmToken = await doGet();
    }

    if (!fcmToken) return;

    // 3) If token changed, POST to backend
    const last = localStorage.getItem(LS_LAST_PUSH_TOKEN) || '';
    if (last !== fcmToken) {
      try {
        await postJSON('api/push/register', {
          token: fcmToken,
          platform: 'web',
          phone_hint: phoneHint || null,
        });
        localStorage.setItem(LS_LAST_PUSH_TOKEN, fcmToken);
        console.log('✅ Push token registered');
      } catch (e) {
        console.warn('⚠️ Failed to register push token', e);
      }
    }

    // 4) Foreground message hook (optional)
    try {
      onMessage(messaging, (payload) => {
        console.log('[notify] foreground message', payload);
      });
    } catch {}
  } catch (err) {
    console.warn('[notify] getToken failed', err);
  }
}

/* ----------------------------- Local test notification ----------------------------- */
/**
 * Shows a local notification immediately (no backend).
 * Returns true if shown, false otherwise.
 */
export async function sendLocalTestNotification(
  title = 'BiteWise test notification',
  body = 'If you see this, notifications are working on this device.'
): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    if (canUsePush()) {
      try {
        const reg = await (navigator as any).serviceWorker.ready;
        await reg.showNotification(title, { body, icon: '/icons/icon-192.png' });
        return true;
      } catch {
        // fall back
      }
    }
    new Notification(title, { body, icon: '/icons/icon-192.png' });
    return true;
  } catch {
    return false;
  }
}

/* ----------------------------- Generic local notification ----------------------------- */
/**
 * Generic local notification helper used by orderReturn flow.
 * Returns true if shown, false otherwise.
 */
export async function sendLocalNotification(title: string, body: string): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    if (canUsePush()) {
      try {
        const reg = await (navigator as any).serviceWorker.ready;
        await reg.showNotification(title, { body, icon: '/icons/icon-192.png' });
        return true;
      } catch {
        // fallback to plain Notification
      }
    }
    new Notification(title, { body, icon: '/icons/icon-192.png' } as any);
    return true;
  } catch {
    return false;
  }
}
/// <reference types="vite/client" />
// src/lib/notify.ts
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { track } from "./track";

/* ----------------------------- Constants ----------------------------- */
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");
const LS_LAST_PUSH_TOKEN = "bw.push.token";

async function ensureMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (err) {
    console.warn("[notify] sw register failed", err);
    return null;
  }
}

/* ----------------------------- Firebase App ----------------------------- */
function getFirebaseApp() {
  const existing = getApps();
  if (existing.length) return existing[0];
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  };
  return initializeApp(cfg);
}

/* ----------------------------- Permission helpers ----------------------------- */
export async function ensureNotifPermissionOrRoute(nav?: (path: string) => void) {
  if (!("Notification" in window)) return;
  const status = (Notification as any).permission;
  if (status === "granted") return;
  if (status === "denied") {
    if (nav) nav("/onboarding/perm/notifications");
    return;
  }
  try {
    await (Notification as any).requestPermission?.();
  } catch {}
}

function canUsePush(): boolean {
  try {
    return "serviceWorker" in navigator && "PushManager" in window;
  } catch {
    return false;
  }
}

/* ----------------------------- Internal helper ----------------------------- */
async function postJSON(path: string, body: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const user = getAuth().currentUser;
  if (!user) throw new Error("not authed");
  const token = await user.getIdToken();
  headers.Authorization = `Bearer ${token}`;
  const base = API_BASE.replace(/\/$/, "");
  const finalPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(base + finalPath, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as any)?.ok === false)
    throw new Error((data as any)?.error || res.statusText);
  return data;
}

/* ----------------------------- FCM registration ----------------------------- */
let inflightGetToken: Promise<string | null> | null = null;
export async function initOrRefreshPushOnAuth(phoneHint?: string) {
  try {
    if (!(await isSupported())) {
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

  try {
    await ensureNotifPermissionOrRoute();
    if (!("Notification" in window) || Notification.permission !== "granted") return;
  } catch {}

  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  if (!VAPID_KEY) {
    console.warn("[notify] Missing VITE_FCM_VAPID_KEY; push will not register.");
    return;
  }

  const swReg = await ensureMessagingServiceWorker();
  if (!swReg) return;

  const doGet = async () => {
    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  };

  try {
    const retryGet = async () => {
      inflightGetToken = inflightGetToken || doGet();
      let fcmToken = await inflightGetToken;
      inflightGetToken = null;
      if (!fcmToken) {
        await new Promise((r) => setTimeout(r, 800));
        fcmToken = await doGet();
      }
      return fcmToken;
    };

    let fcmToken = await retryGet();
    if (!fcmToken) {
      await new Promise((r) => setTimeout(r, 1200));
      fcmToken = await retryGet();
    }
    if (!fcmToken) return;

    const last = localStorage.getItem(LS_LAST_PUSH_TOKEN) || "";
    if (last !== fcmToken) {
      try {
        await postJSON(`/push/register`, {
          token: fcmToken,
          platform: "web",
          phone_hint: phoneHint || null,
        });
        localStorage.setItem(LS_LAST_PUSH_TOKEN, fcmToken);
        console.log("✅ Push token registered");
        track("push_registered", { phone: phoneHint || null });
      } catch (e) {
        console.warn("⚠️ Failed to register push token", e);
        track("push_registration_failed", { reason: (e as Error)?.message });
        throw e;
      }
    }

    try {
      onMessage(messaging, (payload) => {
        console.log("[notify] foreground message", payload);
      });
    } catch {}
  } catch (err) {
    console.warn("[notify] getToken failed", err);
    track("push_registration_failed", { reason: (err as Error)?.message });
  }
}

// Re-run push registration when auth changes or window focuses (soft refresh)
try {
  if (typeof window !== "undefined") {
    const auth = getAuth();
    auth.onAuthStateChanged(() => {
      void initOrRefreshPushOnAuth();
    });
    window.addEventListener("focus", () => {
      void initOrRefreshPushOnAuth();
    });
  }
} catch {}

/* ----------------------------- Local test notification ----------------------------- */
export async function sendLocalTestNotification(
  title = "BiteWise test notification",
  body = "If you see this, notifications are working on this device."
): Promise<boolean> {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;
    if (canUsePush()) {
      try {
        const reg = await (navigator as any).serviceWorker.ready;
        await reg.showNotification(title, { body, icon: "/icons/icon-192.png" });
        return true;
      } catch {}
    }
    new Notification(title, { body, icon: "/icons/icon-192.png" });
    return true;
  } catch {
    return false;
  }
}

export async function sendLocalNotification(title: string, body: string): Promise<boolean> {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;
    if (canUsePush()) {
      try {
        const reg = await (navigator as any).serviceWorker.ready;
        await reg.showNotification(title, { body, icon: "/icons/icon-192.png" });
        return true;
      } catch {}
    }
    new Notification(title, { body, icon: "/icons/icon-192.png" } as any);
    return true;
  } catch {
    return false;
  }
}

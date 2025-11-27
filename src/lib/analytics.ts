import { getAuth } from "firebase/auth";
import { resolveApiBase } from "./apiBase";

export type AnalyticsEventName =
  | "login_success"
  | "unlock_success"
  | "compare_outbound"
  | "order_complete"
  | "push_registered"
  | "push_registration_failed"
  | "mint_token_failed";

type EventInput = {
  name: AnalyticsEventName;
  props?: Record<string, unknown>;
};

const queue: Array<{ name: AnalyticsEventName; props?: Record<string, unknown>; ts: number }> = [];
let flushTimer: number | null = null;
let idleHandle: number | null = null;
const API_BASE = resolveApiBase();

function scheduleFlush(delay = 1500) {
  if (flushTimer || idleHandle) return;
  const useIdle = typeof window !== "undefined" && "requestIdleCallback" in window;
  if (useIdle) {
    idleHandle = (window as any).requestIdleCallback(
      () => {
        idleHandle = null;
        void flush();
      },
      { timeout: delay }
    );
  } else {
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      void flush();
    }, delay);
  }
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, 25);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    queue.unshift(...batch);
    scheduleFlush(2000);
    return;
  }
  try {
    const token = await currentUser.getIdToken();
    await fetch(`${API_BASE}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch (err) {
    console.warn("[analytics] flush failed", err);
    queue.unshift(...batch);
    scheduleFlush(5000);
  } finally {
    if (idleHandle && typeof window !== "undefined" && "cancelIdleCallback" in window) {
      (window as any).cancelIdleCallback(idleHandle);
      idleHandle = null;
    }
  }
}

export function track(name: AnalyticsEventName, props?: Record<string, unknown>) {
  queue.push({ name, props, ts: Date.now() });
  if (queue.length >= 20) {
    void flush();
  } else {
    scheduleFlush();
  }
}

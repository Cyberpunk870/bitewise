import { getAuth } from "firebase/auth";
import { resolveApiBase } from "./apiBase";

export type AnalyticsEventName = string;

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
  // If user not logged in yet, fall back to lightweight metrics ingest (no auth).
  if (!currentUser) {
    try {
      await fetch(`${API_BASE}/metrics/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          batch.map((b) => ({
            event: b.name,
            screen: (b.props as any)?.screen || undefined,
            ts: b.ts,
            props: b.props || {},
          }))
        ),
        keepalive: true,
      });
    } catch (err) {
      console.warn("[analytics] anon flush failed", err);
      queue.unshift(...batch);
      scheduleFlush(5000);
    }
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

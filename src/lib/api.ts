/** 
 * Central API layer for BiteWise frontend ↔ backend sync 
 * Connects to backend routes defined in bitewise/server/index.ts 
 */
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { logError } from "./logger";
import { captureError } from "./sentry";
import { enqueue, dequeue, peekAll } from "./queue";

// ✅ FIXED: Correct base depending on dev/prod
import { resolveApiBase } from "./apiBase";

const BASE = resolveApiBase();

// --- Wait for Firebase to restore the user (used by authHeader) ---
async function waitForFirebaseUser(maxMs = 8000): Promise<User | null> {
  const auth = getAuth();
  if (auth.currentUser) return auth.currentUser;
  return await new Promise<User | null>((resolve) => {
    let unsub = () => {};
    const timer = setTimeout(() => {
      try { unsub(); } catch {}
      resolve(getAuth().currentUser ?? null);
    }, maxMs);
    unsub = onAuthStateChanged(
      auth,
      (u) => {
        clearTimeout(timer);
        try { unsub(); } catch {}
        resolve(u ?? null);
      },
    );
  });
}

// --- Helper to attach Firebase ID token (with auto refresh on 401) ---
async function getBearerToken(forceRefresh = false): Promise<string> {
  let user = getAuth().currentUser;
  if (!user) user = await waitForFirebaseUser(8000);
  if (!user) throw new Error("missing bearer token");
  return await user.getIdToken(forceRefresh);
}

// --- Helper for safe response handling ---
async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && data.error) || res.statusText || "Request failed";
    try {
      captureError(new Error("api_error"), {
        status: res.status,
        statusText: res.statusText,
        url: res.url,
        body: msg,
      });
    } catch {}
    throw new Error(msg);
  }
  return data;
}

// --- Generic helpers ---
type RequestInitLite = RequestInit & { body?: string };

async function requestWithAuth(
  path: string,
  init: RequestInitLite,
  opts: { retry?: boolean } = {}
) {
  const retry = opts.retry !== false;
  const url = `${BASE}${path}`;

  const run = async (forceRefresh: boolean) => {
    const token = await getBearerToken(forceRefresh);
    const headers = {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    return fetch(url, {
      ...init,
      headers,
      credentials: "omit",
    });
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const isWrite = init.method && init.method.toUpperCase() !== "GET";
    if (isWrite) {
      enqueue(path, init.body ? JSON.parse(String(init.body)) : {});
    }
    const offlineErr = new Error("You appear to be offline. Please reconnect and try again.");
    captureError(offlineErr, { path, method: init.method || "GET", queued: isWrite });
    throw offlineErr;
  }

  try {
    let res = await run(false);
    if (res.status === 401 && retry) {
      res = await run(true);
    }
    return handleResponse(res as unknown as Response);
  } catch (err: any) {
    captureError(err, { path, method: init.method || "GET" });
    throw err;
  }
}

// Retry queued writes when back online
if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    const items = peekAll();
    for (const item of items) {
      try {
        await apiPost(item.path, item.body);
        dequeue(item.id);
      } catch (err) {
        captureError(err, { path: item.path, retry: true });
      }
    }
  });
}

export async function apiGet(path: string) {
  return requestWithAuth(
    path,
    { method: "GET", headers: { Accept: "application/json" } },
    { retry: true }
  );
}

export async function apiPost(path: string, body: unknown) {
  const payload = JSON.stringify(body);
  return requestWithAuth(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    },
    { retry: true }
  );
}

export async function apiDelete(path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  let payload: string | undefined = undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return requestWithAuth(
    path,
    {
      method: "DELETE",
      headers,
      body: payload,
    },
    { retry: true }
  );
}

// ------------------------------------------------------------------
// 🧭 User Profile / Coins
// ------------------------------------------------------------------
export async function getUserProfile() {
  try {
    return await apiGet(`/user/profile`);
  } catch (err) {
    logError('getUserProfile failed', { err: String(err) });
    throw err;
  }
}

export async function upsertProfile(profile: { name?: string; phone?: string; }) {
  try {
    return await apiPost(`/user/profile`, profile);
  } catch (err) {
    logError('upsertProfile failed', { err: String(err), profile });
    throw err;
  }
}

export async function addCoins(amount: number, reason: string) {
  try {
    return await apiPost(`/user/coins/add`, { amount, reason });
  } catch (err) {
    logError('addCoins failed', { err: String(err), reason, amount }, { toast: true });
    throw err;
  }
}

export async function getCoinsSummary() {
  try {
    return await apiGet(`/user/coins/summary`);
  } catch (err) {
    logError('getCoinsSummary failed', { err: String(err) });
    throw err;
  }
}

// ------------------------------------------------------------------
// 🤝 Referrals
// ------------------------------------------------------------------
export function getReferralStatus() {
  return apiGet(`/referral/status`);
}

export function createReferralCode() {
  return apiPost(`/referral/create`, {});
}

export function redeemReferralCode(code: string) {
  return apiPost(`/referral/redeem`, { code });
}

// ------------------------------------------------------------------
// 🎨 Themes / promos
// ------------------------------------------------------------------
export async function fetchThemesPublic() {
  const res = await fetch(`${resolveApiBase()}/themes`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to fetch themes');
  return data.themes || [];
}

export function trackThemeEvent(name: string, event: 'impression' | 'click') {
  return fetch(`${resolveApiBase()}/themes/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, event }),
  }).catch(() => {});
}

// ------------------------------------------------------------------
// 📊 Analytics
// ------------------------------------------------------------------
export function getAnalyticsSummary(days = 7) {
  return apiGet(`/analytics/summary?days=${days}`);
}

// ------------------------------------------------------------------
// 🥇 Leaderboard / Achievements / Tasks
// ------------------------------------------------------------------
export function getLeaderboard() {
  return apiGet(`/leaderboard`);
}

export function getAchievements() {
  return apiGet(`/achievements`);
}

export function getTasks() {
  return apiGet(`/tasks`);
}

export function getMissionState() {
  return apiGet(`/missions/state`);
}

export function saveMissionState(payload: {
  dayKey: string;
  totalCompleted: number;
  streak: { current: number; best: number; lastDay: string | null };
  tasks: Array<{
    id: string;
    kind: string;
    title: string;
    target: number;
    reward: number;
    day: number;
    progress: number;
    ready: boolean;
    done: boolean;
    dueTs?: number | null;
  }>;
}) {
  return apiPost(`/missions/state`, payload);
}

// ------------------------------------------------------------------
// 🏠 User Addresses
// ------------------------------------------------------------------
export async function getAddresses() {
  const res = await apiGet(`/user/addresses`);
  return res.data || res.list || [];
}

export function addAddress(address: {
  id?: string;
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  active?: boolean;
}) {
  return apiPost(`/user/addresses`, address);
}

export function getNearest(lat: number, lng: number) {
  return apiGet(`/user/nearest?lat=${lat}&lng=${lng}`);
}

// ------------------------------------------------------------------
// 🍔 Orders (Outbound + Completion + History)
// ------------------------------------------------------------------
export function markOutbound(payload: {
  platform?: string;
  partner?: string;
  restaurant?: string;
  restaurant_id?: string;
  dish_name?: string;
  total?: number;
  otherTotal?: number;
  delta?: number;
}) {
  return apiPost(`/orders/outbound`, payload);
}

export function markCompletion(id: string, saved_amount: number) {
  return apiPost(`/orders/complete`, { id, saved_amount });
}

export function getOrders() {
  return apiGet(`/orders`);
}

// ------------------------------------------------------------------
// 📣 Feedback
// ------------------------------------------------------------------
export function submitFeedback(payload: {
  message: string;
  category?: string;
  steps?: string;
  screen?: string;
  severity?: string;
  deviceInfo?: string;
}) {
  return apiPost(`/feedback`, payload);
}

// ------------------------------------------------------------------
// 🩺 Health / Debug endpoints
// ------------------------------------------------------------------
export function getHealth() {
  return apiGet(`/health`);
}

export function getDebugInfo() {
  return apiGet(`/debug/ready`);
}

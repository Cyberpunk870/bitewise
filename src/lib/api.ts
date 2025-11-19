/** 
 * Central API layer for BiteWise frontend ↔ backend sync 
 * Connects to backend routes defined in bitewise/server/index.ts 
 */
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

// ✅ FIXED: Correct base depending on dev/prod
const BASE = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

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

// --- Helper to attach Firebase ID token (robust; handles passkey unlock) ---
async function authHeader(): Promise<Record<string, string>> {
  let user = getAuth().currentUser;
  if (!user) user = await waitForFirebaseUser(8000);
  if (!user) throw new Error("missing bearer token");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// --- Helper for safe response handling ---
async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && data.error) || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

// --- Generic helpers ---
export async function apiGet(path: string) {
  const headers = { Accept: "application/json", ...(await authHeader()) };
  return fetch(`${BASE}${path}`, {
    method: "GET",
    headers,
    credentials: "omit",
  }).then(handleResponse);
}

export async function apiPost(path: string, body: unknown) {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "omit",
  }).then(handleResponse);
}

export async function apiDelete(path: string, body?: unknown) {
  const headers: Record<string, string> = { ...(await authHeader()) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "omit",
  }).then(handleResponse);
}

// ------------------------------------------------------------------
// 🧭 User Profile / Coins
// ------------------------------------------------------------------
export function getUserProfile() {
  return apiGet(`/user/profile`);
}

export function upsertProfile(profile: { name?: string; phone?: string; }) {
  return apiPost(`/user/profile`, profile);
}

export function addCoins(amount: number, reason: string) {
  return apiPost(`/user/coins/add`, { amount, reason });
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
// 🩺 Health / Debug endpoints
// ------------------------------------------------------------------
export function getHealth() {
  return apiGet(`/health`);
}

export function getDebugInfo() {
  return apiGet(`/debug/ready`);
}

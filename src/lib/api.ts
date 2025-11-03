/** 
 * Central API layer for BiteWise frontend ↔ backend sync
 * Connects to backend routes defined in bitewise/server/index.ts
 */
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

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
      // @ts-expect-error onlyOnce is ignored if not supported
      { onlyOnce: true }
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

// ------------------------------------------------------------------
// 🧭 User Profile / Coins
// ------------------------------------------------------------------
export function getUserProfile() {
  // server reads uid from bearer token; query param no longer needed/used
  return apiGet(`/api/users/profile`);
}

export function upsertProfile(profile: {
  name?: string;
  phone?: string;
}) {
  // server injects uid from token and ignores any uid field in body
  return apiPost("/api/users/profile", profile);
}

export function addCoins(amount: number, reason: string) {
  // server injects uid from token
  return apiPost("/api/users/coins/add", { amount, reason });
}

// ------------------------------------------------------------------
// 🥇 Leaderboard / Achievements / Tasks
// ------------------------------------------------------------------
export function getLeaderboard() {
  return apiGet("/api/leaderboard");
}

export function getAchievements() {
  return apiGet("/api/achievements");
}

export function getTasks() {
  return apiGet("/api/tasks");
}

// ------------------------------------------------------------------
// 🏠 User Addresses
// ------------------------------------------------------------------
export async function getAddresses() {
  // server reads uid from Authorization token
  const res = await apiGet(`/api/user/addresses`);
  return res.data || res.list || []; // normalize
}

export function addAddress(address: {
  id?: string;
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  active?: boolean;
}) {
  // server reads uid from token and ignores any uid client tries to send
  return apiPost("/api/user/addresses", address);
}

export function getNearest(lat: number, lng: number) {
  // server reads uid from token
  return apiGet(`/api/user/nearest?lat=${lat}&lng=${lng}`);
}

// ------------------------------------------------------------------
// 🍔 Orders (Outbound + Completion + History)
// ------------------------------------------------------------------
export function markOutbound(payload: {
  // NOTE: backend injects user_id from token, so we DO NOT send it.
  platform?: string;
  partner?: string;
  restaurant?: string;
  restaurant_id?: string;
  dish_name?: string;
  total?: number;
  otherTotal?: number;
  delta?: number;
}) {
  return apiPost("/api/orders/outbound", payload);
}

export function markCompletion(id: string, saved_amount: number) {
  return apiPost("/api/orders/complete", { id, saved_amount });
}

export function getOrders() {
  // server reads uid from Authorization token
  return apiGet(`/api/orders`);
}

// ------------------------------------------------------------------
// 🩺 Health / Debug endpoints
// ------------------------------------------------------------------
export function getHealth() {
  return apiGet("/api/health");
}

export function getDebugInfo() {
  return apiGet("/api/debug/ready");
}
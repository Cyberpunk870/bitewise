// src/api/apiFetch.ts
import { getAuth } from "firebase/auth";
import { waitForAuthInit } from "../hooks/authReady";
import { track } from "../lib/track";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");


/**
 * apiFetch wraps fetch():
 * - waits for Firebase Auth init (user may still be null if signed out)
 * - attaches Authorization: Bearer <idToken> when signed in
 * - retries once on 401 with a forced token refresh
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  // Ensure auth is initialized (prevents early unauth'd calls)
  const user = await waitForAuthInit();

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  // Only set Content-Type for JSON bodies. Let the browser set it for FormData/Blob.
  const bodyIsString = typeof init.body === "string";
  const bodyIsFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const bodyIsBlob = typeof Blob !== "undefined" && init.body instanceof Blob;

  if (!headers.has("Content-Type") && !bodyIsFormData && !bodyIsBlob) {
    // default to JSON if caller passed an object (we'll stringify below)
    if (init.body && !bodyIsString) headers.set("Content-Type", "application/json");
  }

  // Attach token if available
  let token: string | null = null;
  if (user) token = await user.getIdToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const buildInit = (finalBody: BodyInit | null | undefined): RequestInit => ({
    ...init,
    headers,
    body: finalBody,
  });

  // Normalize JSON body
  const normalizedBody =
    init.body && !bodyIsString && !bodyIsFormData && !bodyIsBlob
      ? JSON.stringify(init.body)
      : init.body;

  const doFetch = () => fetch(API_BASE + path, buildInit(normalizedBody));

  let res: Response;
  try {
    res = await doFetch();
  } catch (err: any) {
    try { track("api_error", { path, error: err?.message || "fetch_failed" }); } catch {}
    throw err;
  }

  // If unauthorized and we have a user, try once with a forced refresh
  if (res.status === 401 && user) {
    try {
      const fresh = await user.getIdToken(true);
      if (fresh) headers.set("Authorization", `Bearer ${fresh}`);
      res = await doFetch();
    } catch {
      // swallow and return original response below
    }
  }

  return res;
}

/**
 * Convenience: JSON helper that throws on non-2xx, and on { ok:false } payloads.
 */
export async function apiJSON<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (
    !res.ok ||
    (data && typeof data === "object" && "ok" in data && (data as any).ok === false)
  ) {
    const msg =
      (data as any)?.error ||
      res.statusText ||
      `Request failed with status ${res.status}`;
    try { track("api_error", { path, status: res.status, error: msg }); } catch {}
    throw new Error(msg);
  }
  return data as T;
}

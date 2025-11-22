// src/lib/webauthnClient.ts
import {
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { apiDelete, apiGet, apiPost } from "./api";
import { resolveApiBase } from "./apiBase";

export type PasskeySummary = {
  id: string;
  label?: string;
  deviceType?: string | null;
  backedUp?: boolean | null;
  createdAt?: string;
  lastUsedAt?: string;
};

const API_BASE = resolveApiBase();

function publicUrl(path: string) {
  const base = API_BASE.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function publicPost<T = any>(path: string, body: unknown): Promise<T> {
  const target = publicUrl(path);
  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.ok === false)) {
    const err = new Error(String(data?.error || res.statusText || "Request failed"));
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}

export async function fetchPasskeys(): Promise<PasskeySummary[]> {
  const res = await apiGet(`/auth/webauthn/passkeys`);
  return (res.passkeys || []) as PasskeySummary[];
}

export async function deletePasskey(id: string): Promise<void> {
  await apiDelete(`/auth/webauthn/passkeys/${encodeURIComponent(id)}`);
}

export async function requestRegistrationOptions(label?: string) {
  const res = await apiPost(`/auth/webauthn/register/options`, { label: label ?? null });
  return res.options as PublicKeyCredentialCreationOptionsJSON;
}

export async function verifyRegistration(
  credential: RegistrationResponseJSON,
  client?: { label?: string; userAgent?: string }
) {
  return apiPost(`/auth/webauthn/register/verify`, { credential, client });
}

export async function requestAuthenticationOptions(phone: string) {
  const res = await publicPost(`/auth/webauthn/authenticate/options`, { phone });
  return res.options as PublicKeyCredentialRequestOptionsJSON;
}

export async function verifyAuthentication(phone: string, credential: AuthenticationResponseJSON) {
  const res = await publicPost<{ ok: boolean; token?: string }>(
    `/auth/webauthn/authenticate/verify`,
    { phone, credential }
  );
  return res;
}

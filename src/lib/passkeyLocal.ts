// src/lib/passkeyLocal.ts
// WHY: Device-local quick unlock after idle. Not a server-side secret.

const KEY_PREFIX = 'bw.pk.'; // bw.pk.+91XXXXXXXXXX

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function setLocalPasskey(phoneE164: string, passkey: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const hash = await sha256Hex(passkey + salt);
  localStorage.setItem(`${KEY_PREFIX}${phoneE164}`, JSON.stringify({ salt, hash }));
}

export function hasLocalPasskey(phoneE164: string): boolean {
  return !!localStorage.getItem(`${KEY_PREFIX}${phoneE164}`);
}

export async function verifyLocalPasskey(phoneE164: string, passkey: string): Promise<boolean> {
  const raw = localStorage.getItem(`${KEY_PREFIX}${phoneE164}`);
  if (!raw) return false;
  try {
    const { salt, hash } = JSON.parse(raw) as { salt: string; hash: string };
    const h = await sha256Hex(passkey + salt);
    return h === hash;
  } catch {
    return false;
  }
}

export function clearLocalPasskey(phoneE164: string) {
  localStorage.removeItem(`${KEY_PREFIX}${phoneE164}`);
}

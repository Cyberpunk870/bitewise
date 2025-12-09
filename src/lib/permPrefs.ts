// src/lib/permPrefs.ts

// The three choices shown in onboarding & settings.
export type PermPolicy = 'always' | 'session' | 'never';
// The permissions we manage.
export type PermKey = 'location' | 'notifications' | 'microphone';
export type MicPermission = 'always' | 'once' | 'never' | 'unknown';
export const PERM_KEY_MIC: PermKey = 'microphone';

import { useEffect, useState } from 'react';

// Internal storage keys
const LS_KEY = 'bw:permPrefs:v1';      // localStorage (persists across sessions)
const SS_PREFIX = 'bw:permSession:';   // sessionStorage (clears on tab close)

type Shape = Partial<Record<PermKey, PermPolicy>>;
const ALL_KEYS: PermKey[] = ['location', 'notifications', 'microphone'];

// Normalise any legacy string values into our canonical policies.
function normalize(val: any): PermPolicy | undefined {
  if (val === 'always' || val === 'session' || val === 'never') return val;
  if (val === 'allow' || val === 'granted' || val === 'on') return 'always';
  if (val === 'deny' || val === 'denied' || val === 'blocked' || val === 'off') return 'never';
  return undefined;
}

/* ------------------------- storage helpers ------------------------- */

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

function loadLS(): Shape {
  try {
    const parsed = safeParse<Record<string, any>>(localStorage.getItem(LS_KEY)) || {};

    // migrate legacy mic key -> microphone
    if (parsed.mic && !parsed.microphone) {
      parsed.microphone = parsed.mic;
      delete parsed.mic;
    }

    // normalise any legacy values
    let mutated = false;
    for (const k of Object.keys(parsed)) {
      if (!(['location', 'notifications', 'microphone'] as const).includes(k as any)) {
        mutated = true;
        delete parsed[k];
        continue;
      }
      const norm = normalize(parsed[k]);
      if (!norm) {
        mutated = true;
        delete parsed[k];
      } else if (norm !== parsed[k]) {
        mutated = true;
        parsed[k] = norm;
      }
    }

    if (mutated) saveLS(parsed as Shape);
    return parsed as Shape;
  } catch {
    return {};
  }
}

function saveLS(next: Shape) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); }
  catch { /* ignore private mode / quota errors */ }
}

function setSS(key: PermKey, on: boolean) {
  try {
    if (on) sessionStorage.setItem(SS_PREFIX + key, '1');
    else sessionStorage.removeItem(SS_PREFIX + key);
  } catch { /* ignore */ }
}

function hasSS(key: PermKey): boolean {
  try { return sessionStorage.getItem(SS_PREFIX + key) === '1'; }
  catch { return false; }
}

/* ------------------------------- API ------------------------------- */

/** Get the current policy for a permission. */
export function getPermPolicy(key: PermKey): PermPolicy | undefined {
  if (hasSS(key)) return 'session';
  const ls = loadLS();
  return ls[key];
}

/** Set the policy for a permission. */
export function setPermPolicy(key: PermKey, value: PermPolicy): void {
  const ls = loadLS();

  if (value === 'session') {
    delete ls[key];
    saveLS(ls);
    setSS(key, true);
    return;
  }

  ls[key] = value;
  saveLS(ls);
  setSS(key, false);
}

/** Clear the saved policy for a single permission key. */
export function clearPermPolicy(key: PermKey): void {
  const ls = loadLS();
  if (key in ls) {
    delete ls[key];
    saveLS(ls);
  }
  setSS(key, false);
}

/** Convenience: clear all saved permission choices. */
export function clearPermPrefs(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  for (const k of ALL_KEYS) setSS(k, false);
}

/** Clear only the session-scoped (“Only this time”) flags for this tab. */
export function clearSessionPerms(): void {
  try {
    for (const k of ALL_KEYS) {
      sessionStorage.removeItem(SS_PREFIX + k);
    }
  } catch { /* ignore */ }
}

/** Mark a permission as allowed-for-this-session. */
export function allowForThisSession(key: PermKey): void {
  setSS(key, true);
}

/** Compute immediate decision. */
export type PermDecision = 'allow' | 'deny' | 'ask';
export function decidePerm(key: PermKey): PermDecision {
  const policy = getPermPolicy(key);
  if (policy === 'always') return 'allow';
  if (policy === 'never')  return 'deny';
  if (policy === 'session') return 'allow';
  return 'ask';
}

/* ------------------------- React hook ------------------------- */
/** usePermDecision: live decision that updates on:
 *  - bw:perm:recheck / bw:perm:changed
 *  - storage changes (another tab / settings)
 *  - tab visibility return (edge case)
 */
export function usePermDecision(key: PermKey): PermDecision {
  const [dec, setDec] = useState<PermDecision>(() => decidePerm(key));

  useEffect(() => {
    const refresh = () => setDec(decidePerm(key));
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === LS_KEY || e.key.startsWith(SS_PREFIX)) refresh();
    };

    window.addEventListener('bw:perm:recheck' as any, refresh as any);
    window.addEventListener('bw:perm:changed' as any, refresh as any);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('bw:perm:recheck' as any, refresh as any);
      window.removeEventListener('bw:perm:changed' as any, refresh as any);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [key]);

  return dec;
}

/* -------------------------- Microphone helpers -------------------------- */
function migrateLegacyMic(): PermPolicy | undefined {
  // loadLS already migrates the old "mic" key inside the JSON blob, but we
  // also guard against stray top-level keys.
  try {
    // If already present, trust it.
    const existing = getPermPolicy(PERM_KEY_MIC);
    if (existing) return existing;

    // Legacy session flag
    const sessionLegacy = sessionStorage.getItem('bw:permSession:mic') === '1';
    if (sessionLegacy) {
      allowForThisSession(PERM_KEY_MIC);
      sessionStorage.removeItem('bw:permSession:mic');
      return 'session';
    }

    // Legacy loose keys
    const legacyKeys = ['micStatus', 'permPrefs.mic', 'permPrefs.micStatus'];
    for (const key of legacyKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      localStorage.removeItem(key);
      const lower = raw.toLowerCase();
      if (lower === 'always' || lower === 'granted' || lower === 'allow' || lower === 'on') {
        setPermPolicy(PERM_KEY_MIC, 'always');
        return 'always';
      }
      if (lower === 'session' || lower === 'once') {
        setPermPolicy(PERM_KEY_MIC, 'session');
        return 'session';
      }
      if (lower === 'never' || lower === 'denied' || lower === 'blocked' || lower === 'off') {
        setPermPolicy(PERM_KEY_MIC, 'never');
        return 'never';
      }
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function getMicPermission(): MicPermission {
  const migrated = migrateLegacyMic();
  const policy = migrated ?? getPermPolicy(PERM_KEY_MIC);
  if (policy === 'always') return 'always';
  if (policy === 'session') return 'once';
  if (policy === 'never') return 'never';
  return 'unknown';
}

export function setMicPermission(value: MicPermission): void {
  try {
    // Clear legacy keys proactively
    localStorage.removeItem('micStatus');
    localStorage.removeItem('permPrefs.mic');
    localStorage.removeItem('permPrefs.micStatus');
    sessionStorage.removeItem('bw:permSession:mic');
  } catch { /* ignore */ }

  if (value === 'always') {
    setPermPolicy(PERM_KEY_MIC, 'always');
    return;
  }
  if (value === 'once') {
    setPermPolicy(PERM_KEY_MIC, 'session');
    return;
  }
  if (value === 'never') {
    setPermPolicy(PERM_KEY_MIC, 'never');
    return;
  }
  // unknown → clear
  clearPermPolicy(PERM_KEY_MIC);
}

// src/lib/permPrefs.ts

// The three choices shown in onboarding & settings.
export type PermPolicy = 'always' | 'session' | 'never';
// The permissions we manage.
export type PermKey = 'location' | 'notifications' | 'mic';

import { useEffect, useState } from 'react';

// Internal storage keys
const LS_KEY = 'bw:permPrefs:v1';      // localStorage (persists across sessions)
const SS_PREFIX = 'bw:permSession:';   // sessionStorage (clears on tab close)

type Shape = Partial<Record<PermKey, PermPolicy>>;
const ALL_KEYS: PermKey[] = ['location', 'notifications', 'mic'];

/* ------------------------- storage helpers ------------------------- */

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

function loadLS(): Shape {
  try { return safeParse<Shape>(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
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

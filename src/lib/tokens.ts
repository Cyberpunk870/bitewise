// src/lib/tokens.ts
import { emit } from './events';
import { getUserProfile as apiGetUserProfile } from './api';
import { getAuth } from 'firebase/auth';

const KEY = 'bw.tokens';

/** Read current local token (Bites) balance. */
export function getTokens(): number {
  try {
    return Math.max(0, Math.floor(Number(localStorage.getItem(KEY) || '0')));
  } catch {
    return 0;
  }
}

/** Set local token balance and notify listeners. */
export function setTokens(n: number) {
  const next = Math.max(0, Math.floor(n || 0));
  try {
    localStorage.setItem(KEY, String(next));
  } catch {}

  // Broadcast (both DOM + app bus) so UI widgets refresh.
  try {
    window.dispatchEvent(new Event('bw:tokens:update'));
  } catch {}
  try {
    emit('bw:tokens:update', next);
  } catch {}
}

/** Increment local token balance (also emits gain event). */
export function addTokens(delta: number) {
  const _inc = Math.floor(delta || 0);
  if (_inc <= 0) return;

  const next = Math.max(0, getTokens() + _inc);
  setTokens(next);

  // AUDIT TRAIL (optional, preserved)
  try {
    const audit = JSON.parse(localStorage.getItem('bw.tokens.audit') || '[]');
    audit.unshift({ ts: Date.now(), delta: _inc, total: next });
    localStorage.setItem('bw.tokens.audit', JSON.stringify(audit.slice(0, 200)));
  } catch {}

  // Keep your existing RewardHost/coin-shower hooks happy
  try {
    emit('bw:tokens:gain', { amount: _inc, delta: _inc, total: next });
  } catch {}
  try {
    emit('bw:tokens:update', next);
  } catch {}
}

/* ------------------------------------------------------------------ */
/* 🪙 SYNC FROM CLOUD                                                  */
/* ------------------------------------------------------------------ */
/**
 * Pull canonical coin balance from backend profile and update local cache.
 * Call after login/unlock or after any server-side coin change.
 * Returns the synced total, or null on failure.
 */
export async function syncTokensFromCloud(uid?: string): Promise<number | null> {
  if (!getAuth().currentUser) return null;
  try {
    const res = await apiGetUserProfile(); // no uid needed for current user
    const total = Number(res?.profile?.total_coins ?? NaN);
    if (!Number.isNaN(total)) {
      setTokens(total); // updates storage + emits bw:tokens:update
      return total;
    }
  } catch {
    // ignore network errors silently
  }
  return null;
}
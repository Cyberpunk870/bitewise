// src/lib/tokens.ts
import { emit } from './events';

const KEY = 'bw.tokens';

export function getTokens(): number {
  try { return Number(localStorage.getItem(KEY) || '0'); } catch { return 0; }
}

export function setTokens(n: number) {
  try {
    const safe = Math.max(0, Math.floor(n));
    localStorage.setItem(KEY, String(safe));
    // notify app (header etc.)
    try { window.dispatchEvent(new Event('bw:tokens:update')); } catch {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: String(safe) } as any)); } catch {}
  } catch {}
}

export function addTokens(delta: number) {
  const inc = Math.max(0, Math.floor(delta));
  if (inc <= 0) return;

  const next = Math.max(0, getTokens() + inc);
  setTokens(next);

  // AUDIT TRAIL (optional, preserved)
  try {
    const audit = JSON.parse(localStorage.getItem('bw.tokens.audit') || '[]');
    audit.unshift({ ts: Date.now(), amount: inc });
    localStorage.setItem('bw.tokens.audit', JSON.stringify(audit.slice(0, 200)));
  } catch {}

  // EVENTS
  // Back-compat + new: provide both amount & delta
  try { emit('bw:tokens:gain', { amount: inc, delta: inc, total: next }); } catch {}
  try { emit('bw:tokens:update'); } catch {}

  // Keep your existing RewardHost hook happy
  try { emit('bw:reward', { amount: inc, balance: next }); } catch {}
}

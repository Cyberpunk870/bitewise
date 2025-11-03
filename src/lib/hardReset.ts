// src/lib/hardReset.ts
export function hardReset() {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  try { window.caches?.keys?.().then(keys => keys.forEach(k => window.caches?.delete?.(k))); } catch {}
  try { window.location.replace('/'); } catch { window.location.href = '/'; }
}

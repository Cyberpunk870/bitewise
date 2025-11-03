// Unified "last availability sync" helpers + tiny time-ago

const LS_LAST_SYNC = 'bw.data.lastAvailabilitySync';

export function setLastAvailabilitySync(ts: number = Date.now()) {
  try {
    localStorage.setItem(LS_LAST_SYNC, String(ts));
    // broadcast so screens can update their "last updated" chip
    window.dispatchEvent(new CustomEvent('bw:data:availabilitySync', { detail: ts }));
  } catch {}
}

export function getLastAvailabilitySync(): number | null {
  try {
    const v = Number(localStorage.getItem(LS_LAST_SYNC) || '0');
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

export function timeAgo(ts?: number | null): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

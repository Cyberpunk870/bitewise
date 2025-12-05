// Lightweight client-side metrics emitters
import { emit } from './events';
import { resolveApiBase } from './apiBase';

export function markTtfRender(screen: string, ms: number) {
  try {
    emit('bw:metrics:ttf', { screen, ms });
  } catch {}
  beacon([{ event: 'ttf', screen, ms }]);
}

export function markDataEmpty(screen: string) {
  try {
    emit('bw:metrics:dataEmpty', { screen });
  } catch {}
  beacon([{ event: 'data_empty', screen }]);
}

export function markDataError(screen: string, message?: string) {
  try {
    emit('bw:metrics:dataError', { screen, message });
  } catch {}
  beacon([{ event: 'data_error', screen, message }]);
}

export function markCacheHit(screen: string) {
  try {
    emit('bw:metrics:cacheHit', { screen });
  } catch {}
  beacon([{ event: 'cache_hit', screen }]);
}

function beacon(payload: any) {
  try {
    const base = resolveApiBase().replace(/\/$/, '');
    const url = `${base}/metrics/ingest`;
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

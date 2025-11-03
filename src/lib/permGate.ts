// src/lib/permGate.ts
import { decidePerm } from './permPrefs';

export type Gate = { ok: boolean; reason?: string };

/**
 * Unified HTTPS + API presence check.
 * Browsers will refuse geolocation, notifications, mic access on insecure origins
 * (except localhost/127.0.0.1). So we treat those as "unsupported".
 */
function isSecure(): boolean {
  try {
    return (
      window.isSecureContext ||
      ['localhost', '127.0.0.1'].includes(location.hostname)
    );
  } catch {
    return false;
  }
}

/** ----- LOCATION ----- */
export function gateLocation(): Gate {
  const hasAPI = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  if (!hasAPI || !isSecure())
    return { ok: false, reason: 'unsupported' };

  const d = decidePerm('location');
  if (d === 'allow') return { ok: true };
  if (d === 'deny') return { ok: false, reason: 'denied' };
  return { ok: false, reason: 'ask' };
}

/** ----- NOTIFICATIONS ----- */
export function gateNotifications(): Gate {
  const hasAPI =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    typeof (Notification as any).requestPermission === 'function';
  if (!hasAPI || !isSecure())
    return { ok: false, reason: 'unsupported' };

  const d = decidePerm('notifications');
  if (d === 'allow') return { ok: true };
  if (d === 'deny') return { ok: false, reason: 'denied' };
  return { ok: false, reason: 'ask' };
}

/** ----- MICROPHONE ----- */
export function gateMic(): Gate {
  const hasAPI =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
  if (!hasAPI || !isSecure())
    return { ok: false, reason: 'unsupported' };

  const d = decidePerm('mic');
  if (d === 'allow') return { ok: true };
  if (d === 'deny') return { ok: false, reason: 'denied' };
  return { ok: false, reason: 'ask' };
}
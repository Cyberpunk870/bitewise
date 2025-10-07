// src/lib/permGate.ts
import { decidePerm, getPermPolicy } from './permPrefs';

export type Gate =
  | { ok: true }
  | { ok: false; reason: 'ask' | 'denied' | 'unsupported' };

export function canUse(what: 'location'|'mic'|'notifications'): boolean {
  const d = decidePerm(what); // 'allow' | 'deny' | 'ask'
  return d === 'allow' || d === 'ask' ? true : false; // UI can *try* in-session if 'ask'
}

// Fine-grained gates (use where needed)
export function gateLocation(): Gate {
  if (!('geolocation' in navigator)) return { ok: false, reason: 'unsupported' };
  const d = decidePerm('location');
  if (d === 'allow') return { ok: true };
  if (d === 'deny')  return { ok: false, reason: 'denied' };
  return { ok: false, reason: 'ask' };
}
export function gateMic(): Gate {
  const hasAPI =
    'SpeechRecognition' in (window as any) ||
    'webkitSpeechRecognition' in (window as any);
  if (!hasAPI) return { ok: false, reason: 'unsupported' };
  const d = decidePerm('mic');
  if (d === 'allow') return { ok: true };
  if (d === 'deny')  return { ok: false, reason: 'denied' };
  return { ok: false, reason: 'ask' };
}
export function gateNotifications(): Gate {
  if (!('Notification' in window)) return { ok: false, reason: 'unsupported' };
  const d = decidePerm('notifications');
  if (d === 'allow') return { ok: true };
  if (d === 'deny')  return { ok: false, reason: 'denied' };
  return { ok: false, reason: 'ask' };
}

// Convenience (what the Notifications screen shows)
export { getPermPolicy } from './permPrefs';

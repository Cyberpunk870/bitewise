// src/lib/deeplinkReturn.ts
// Minimal helpers to (a) remember the deep-link the user went to,
// (b) detect when they come back, and (c) surface a banner to confirm.

export type OutboundOrder = {
  ts: number;                 // when deep link clicked
  restaurantId: string;
  restaurantName: string;
  platform: 'swiggy' | 'zomato' | string;
  total: number;              // total shown in Compare for selected platform
  otherTotal?: number;        // competitor total (for "you saved ₹X")
  delta?: number;             // (otherTotal - total) at click-time, if present
  tokenReward?: number;       // Bits to award on confirm
  deepLink?: string;          // opened link (for reference)
};

const KEY = 'bw.order.outbound';
const CONFIRM_KEY = 'bw.order.confirmed';

export function markOutbound(o: OutboundOrder) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(o));
    // Clear any previous confirmation flag
    sessionStorage.removeItem(CONFIRM_KEY);
  } catch {}
}

export function getOutbound(): OutboundOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboundOrder) : null;
  } catch {
    return null;
  }
}

export function clearOutbound() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function setConfirmed() {
  try {
    sessionStorage.setItem(CONFIRM_KEY, '1');
  } catch {}
}

export function isConfirmed(): boolean {
  try {
    return sessionStorage.getItem(CONFIRM_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Should we show the "Did you place it?" banner now?
 * - Only if there’s an outbound within the last 30 minutes
 * - Not if already confirmed
 */
export function shouldShowReturnBanner(now = Date.now()): OutboundOrder | null {
  const o = getOutbound();
  if (!o) return null;
  if (isConfirmed()) return null;
  const THIRTY_MIN = 30 * 60 * 1000;
  if (now - o.ts > THIRTY_MIN) return null;
  return o;
}

export { startOutbound } from './orderReturn';

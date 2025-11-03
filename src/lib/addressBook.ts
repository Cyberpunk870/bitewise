// src/lib/addressBook.ts
import { haversineMeters } from './location';
import { getActiveProfile } from './profileStore';

export type SavedAddr = {
  id: string;           // stable-ish key
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  lastUsedTs: number;
};

const KEY = 'bw.addresses';
const MAX = 3;

export function getAddresses(): SavedAddr[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') || [];
  } catch {
    return [];
  }
}

function save(list: SavedAddr[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
}

/** Add/update the current active profile’s address into the book (MRU). */
export function rememberActiveProfileAddress() {
  const p = getActiveProfile();
  if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
  const id = `${Math.round(p.lat * 1e5)}:${Math.round(p.lng * 1e5)}`; // coarse bucket key
  const now = Date.now();
  const list = getAddresses().filter(a => a.id !== id);
  list.unshift({
    id,
    label: p.addressLabel || 'Saved',
    addressLine: p.addressLine || '',
    lat: p.lat!,
    lng: p.lng!,
    lastUsedTs: now,
  });
  save(list.slice(0, MAX));
}

/** Find the nearest saved address to given coords. */
export function nearestSavedTo(coords: { lat: number; lng: number }): { addr: SavedAddr | null; meters: number | null } {
  const list = getAddresses();
  if (!list.length) return { addr: null, meters: null };
  let best: SavedAddr | null = null;
  let bestM = Infinity;
  for (const a of list) {
    const m = haversineMeters({ lat: a.lat, lng: a.lng }, coords);
    if (m < bestM) {
      bestM = m;
      best = a;
    }
  }
  return { addr: best, meters: Math.round(bestM) };
}

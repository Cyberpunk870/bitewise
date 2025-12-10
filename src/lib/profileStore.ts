// src/lib/profileStore.ts
// Local profile store (multi-profile by phone), with events & last-route helpers.

export type Profile = {
  phone: string;
  name: string;
  addressLabel?: string;
  addressLine?: string;
  city?: string;
  lat?: number;
  lng?: number;
  passkey?: string;
  passkeyMeta?: string;
};

/* Keys */
const KEY_ACTIVE_PHONE_SESSION = 'bw.session.phone';
const KEY_ACTIVE_PHONE_PERSIST = 'bw.active.phone';
const KEY_PROFILE_PREFIX = 'bw.profile.';
const KEY_LEGACY_COORDS_MIRROR = 'bw.profile.coords';
const KEY_LAST_ROUTE = 'bw.last.route';

/* Notifications */
function notifyProfileChanged(key?: string, value?: string | null) {
  try {
    window.dispatchEvent(new Event('bw:profile:update'));
    if (key) {
      window.dispatchEvent(
        new StorageEvent('storage', { key, newValue: value ?? null } as StorageEventInit)
      );
    }
  } catch {
    /* ignore */
  }
}

function writeLegacyCoordsMirror(p: Profile) {
  try {
    if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
      localStorage.setItem(
        KEY_LEGACY_COORDS_MIRROR,
        JSON.stringify({ lat: p.lat, lng: p.lng })
      );
    }
  } catch {
    /* ignore */
  }
}

/* CRUD */
export function saveProfile(p: Profile) {
  if (!p?.phone) return;
  try {
    const key = KEY_PROFILE_PREFIX + p.phone;
    const json = JSON.stringify(p);
    localStorage.setItem(key, json);
    sessionStorage.setItem(KEY_ACTIVE_PHONE_SESSION, p.phone);
    localStorage.setItem(KEY_ACTIVE_PHONE_PERSIST, p.phone);
    writeLegacyCoordsMirror(p);
    notifyProfileChanged(key, json);
  } catch {
    /* ignore */
  }
}

export function loadProfileByPhone(phone: string): Profile | undefined {
  try {
    const raw = localStorage.getItem(KEY_PROFILE_PREFIX + phone);
    return raw ? (JSON.parse(raw) as Profile) : undefined;
  } catch {
    return undefined;
  }
}

export function getActivePhone(): string | null {
  try {
    const s = sessionStorage.getItem(KEY_ACTIVE_PHONE_SESSION);
    if (s) return s;
  } catch {}
  try {
    const p = localStorage.getItem(KEY_ACTIVE_PHONE_PERSIST);
    return p || null;
  } catch {
    return null;
  }
}

export function setActivePhone(phone: string) {
  try {
    sessionStorage.setItem(KEY_ACTIVE_PHONE_SESSION, phone);
    localStorage.setItem(KEY_ACTIVE_PHONE_PERSIST, phone);
    notifyProfileChanged(KEY_ACTIVE_PHONE_SESSION, phone);
  } catch {
    /* ignore */
  }
}

export function getActiveProfile(): Profile | undefined {
  const phone = getActivePhone();
  if (!phone) return undefined;
  return loadProfileByPhone(phone);
}

export function setActiveProfileFields(patch: Partial<Profile>) {
  const cur = getActiveProfile();
  if (!cur) return;
  try {
    const next: Profile = { ...cur, ...patch, phone: cur.phone };
    const key = KEY_PROFILE_PREFIX + cur.phone;
    const json = JSON.stringify(next);
    localStorage.setItem(key, json);
    writeLegacyCoordsMirror(next);
    notifyProfileChanged(key, json);
  } catch {
    /* ignore */
  }
}

export function upsertUser(patch: Profile) {
  if (!patch?.phone) return;
  const existing = loadProfileByPhone(patch.phone) || { phone: patch.phone, name: '' };
  saveProfile({ ...(existing as any), ...(patch as any) });
}

export function removeProfile(phone: string) {
  try {
    const key = KEY_PROFILE_PREFIX + phone;
    localStorage.removeItem(key);
    notifyProfileChanged(key, null);
    const active = getActivePhone();
    if (active === phone) {
      sessionStorage.removeItem(KEY_ACTIVE_PHONE_SESSION);
      localStorage.removeItem(KEY_ACTIVE_PHONE_PERSIST);
      notifyProfileChanged(KEY_ACTIVE_PHONE_SESSION, null);
    }
  } catch {
    /* ignore */
  }
}

export function saveLabeledAddress(
  phone: string,
  next: { label: string; line?: string; lat?: number; lng?: number }
) {
  const p = loadProfileByPhone(phone);
  if (!p) return;
  const updated: Profile = {
    ...p,
    addressLabel: next.label,
    addressLine: next.line ?? p.addressLine,
    lat: typeof next.lat === 'number' ? next.lat : p.lat,
    lng: typeof next.lng === 'number' ? next.lng : p.lng,
  };
  saveProfile(updated);
}

/* Collections / Utils */
export function getAllProfiles(): Profile[] {
  const list: Profile[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (!k.startsWith(KEY_PROFILE_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const p = JSON.parse(raw) as Profile;
        if (p && p.phone) list.push(p);
      } catch {
        /* ignore malformed entries */
      }
    }
  } catch {
    /* ignore */
  }
  return list.sort((a, b) => (a.phone > b.phone ? 1 : -1));
}

export function setActiveProfileById(phone: string) {
  const p = loadProfileByPhone(phone);
  if (!p) return;
  setActivePhone(phone);
  notifyProfileChanged(KEY_ACTIVE_PHONE_SESSION, phone);
}

// ✅ Respect the “ignore local profiles” guard.
export function hasUser(phone: string): boolean {
  try {
    if (localStorage.getItem('bw.ignore.localProfiles') === '1') return false;
    return Boolean(localStorage.getItem(KEY_PROFILE_PREFIX + phone));
  } catch {
    return false;
  }
}

export function getUser(phone: string): Profile | null {
  return loadProfileByPhone(phone) ?? null;
}

export function getActiveCoords(): { lat: number; lng: number } | null {
  const p = getActiveProfile();
  if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
    return { lat: p.lat, lng: p.lng };
  }
  return null;
}

export function ensureActiveProfile(): Profile | null {
  const existing = getActiveProfile();
  if (existing) return existing;
  try {
    const persisted = localStorage.getItem(KEY_ACTIVE_PHONE_PERSIST);
    if (persisted) {
      setActivePhone(persisted);
      const p = loadProfileByPhone(persisted);
      if (p) return p;
    }
  } catch {}
  const all = getAllProfiles();
  if (all.length) {
    setActivePhone(all[0].phone);
    return all[0];
  }
  return null;
}

/* last route helpers (for post-login return) */
export function setLastRoute(path: string) {
  try {
    localStorage.setItem(KEY_LAST_ROUTE, path);
  } catch {
    /* ignore */
  }
}
export function getLastRoute(): string | null {
  try {
    return localStorage.getItem(KEY_LAST_ROUTE) || null;
  } catch {
    return null;
  }
}

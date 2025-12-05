// src/lib/location.ts
// Live location helpers (permission gating, reverse geocode, and smart switch).

import { decidePerm } from './permPrefs';
import { loadGoogleMaps } from './googleMaps';

export type Coords = { lat: number; lng: number };

// 100 m: requirement (priority for saved addresses)
export const SAME_LOCATION_THRESHOLD_M = 100;

/* Saved coords (legacy mirror for older code) */
export function readSavedCoords(): Coords | null {
  try {
    const raw =
      localStorage.getItem('bw.profile.coords') ||
      localStorage.getItem('bw.address.coords') ||
      '';
    if (!raw) return null;
    const { lat, lng } = JSON.parse(raw) || {};
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  } catch {}
  return null;
}

export function writeSessionLocationMode(mode: 'saved' | 'current') {
  try {
    sessionStorage.setItem('bw.session.locationMode', mode);
    window.dispatchEvent(new Event('bw:location:override'));
  } catch {}
}

/* Geolocation + permission */
export async function getCurrentPosition(timeoutMs = 8000): Promise<Coords | null> {
  if (!('geolocation' in navigator)) return null;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 15000,
      })
    );
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function ensureLocationAccess(opts?: {
  onDeny?: () => void;
  onAsk?: () => void;
  navigate?: (path: string) => void;
}): Promise<Coords | null> {
  const p = decidePerm('location'); // 'allow' | 'deny' | 'ask'
  if (p === 'deny') {
    opts?.onDeny?.();
    return null;
  }
  if (p === 'ask') {
    if (opts?.onAsk) opts.onAsk();
    else if (opts?.navigate) opts.navigate('/onboarding/perm/location');
    else if (typeof window !== 'undefined') window.location.href = '/onboarding/perm/location';
    return null;
  }
  return getCurrentPosition(10000);
}

/* Distance */
export function haversineMeters(a: Coords, b: Coords): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const c = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(c)));
}

/* Reverse geocoding (JS → REST → OSM → coarse) */
function inferCityFromCoords({ lat, lng }: Coords): string | null {
  const inBox = (lat1: number, lat2: number, lng1: number, lng2: number) =>
    lat >= Math.min(lat1, lat2) &&
    lat <= Math.max(lat1, lat2) &&
    lng >= Math.min(lng1, lng2) &&
    lng <= Math.max(lng1, lng2);

  if (inBox(28.35, 28.75, 76.84, 77.35)) return 'Gurugram';
  if (inBox(28.45, 28.75, 77.25, 77.45)) return 'Delhi';
  if (inBox(28.45, 28.75, 77.35, 77.55)) return 'East Delhi';
  if (inBox(28.45, 28.75, 77.30, 77.70)) return 'Noida';
  if (inBox(28.55, 28.85, 77.35, 77.65)) return 'Ghaziabad';
  if (inBox(28.30, 28.50, 77.20, 77.40)) return 'Faridabad';
  return null;
}

export async function reverseGeocode(coords: Coords): Promise<string> {
  const { lat, lng } = coords;

  // 1) JS Geocoder
  try {
    const g = await loadGoogleMaps().catch(() => null as any);
    const Geocoder = (g as any)?.maps?.Geocoder;
    if (Geocoder) {
      const geocoder = new Geocoder();
      const results: any[] = await new Promise((resolve, reject) => {
        geocoder.geocode(
          { location: { lat, lng } },
          (res: any[], status: string) => {
            if (status === 'OK' && Array.isArray(res) && res.length) resolve(res);
            else reject(new Error(status || 'GEOCODE_FAILED'));
          }
        );
      });
      const line = results?.[0]?.formatted_address as string | undefined;
      if (line) return line;
    }
  } catch {}

  // 2) REST Geocode
  try {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (apiKey) {
      const url =
        'https://maps.googleapis.com/maps/api/geocode/json' +
        `?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}` +
        `&result_type=street_address|premise|sublocality|locality&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const line = data?.results?.[0]?.formatted_address as string | undefined;
        if (line) return line;
      }
    }
  } catch {}

  // 3) OSM fallback
  try {
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
      `&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } });
    if (res.ok) {
      const data = await res.json();
      const line: string | undefined = (data && data.display_name) || undefined;
      if (line) return line;
    }
  } catch {}

  const city = inferCityFromCoords(coords);
  if (city) return city;
  return `Location @ ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

export function deriveAddressLabel(addressLine: unknown): string {
  const parts = (String(addressLine) || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!parts.length) return 'Current';
  for (const p of parts) {
    if (
      /sector|phase|nagar|vihar|enclave|road|marg|market|block|colony|park|noida|delhi|gurgaon|gurugram|ghaziabad|faridabad/i.test(
        p
      )
    )
      return p;
  }
  return parts[1] || parts[0];
}

/* Startup helper for Home.tsx: auto-switch if within 100 m of any saved */
type LivePromptFn = (args: { live: Coords; metersFromActive: number }) => void;

/**
 * Returns:
 * - 'auto-switched' if we found a saved profile within SAME_LOCATION_THRESHOLD_M and switched.
 * - 'prompted'      if we want Home to show the "Use current?" modal.
 * - 'none'          otherwise.
 */
export async function maybeLiveLocationFlow(
  onNeedPrompt: LivePromptFn
): Promise<'none' | 'auto-switched' | 'prompted'> {
  const p = decidePerm('location');
  if (p === 'deny') return 'none';

  const live = await getCurrentPosition(6000);
  if (!live) return 'none';

  try {
    const { getActiveProfile, getAllProfiles, setActiveProfileById } = await import('./profileStore');
    const active = getActiveProfile();
    const profiles = (getAllProfiles?.() || []).filter(
      (pr: any) => typeof pr?.lat === 'number' && typeof pr?.lng === 'number'
    );

    const nearby = profiles.find(
      (pr: any) => haversineMeters({ lat: pr.lat, lng: pr.lng }, live) <= SAME_LOCATION_THRESHOLD_M
    );

    if (nearby) {
      if (!active || nearby.phone !== active.phone) {
        setActiveProfileById?.(nearby.phone || (nearby as any).id);
        return 'auto-switched';
      }
      return 'none';
    }

    // If active profile has NO coords at all, prompt to use current.
    const hasActiveCoords = active && typeof active.lat === 'number' && typeof active.lng === 'number';
    if (!hasActiveCoords) {
      onNeedPrompt({ live, metersFromActive: NaN });
      return 'prompted';
    }

    // Otherwise, compare to active coords and prompt when far enough
    const meters = haversineMeters({ lat: active.lat!, lng: active.lng! }, live);
    if (meters > SAME_LOCATION_THRESHOLD_M) {
      onNeedPrompt({ live, metersFromActive: Math.round(meters) });
      return 'prompted';
    }

    return 'none';
  } catch {
    return 'none';
  }
}

/* Continuous watcher (optional; can be started by AppShell or Home) */
let watchId: number | null = null;
export function startLiveLocationWatcher(intervalMs = 15000) {
  if (!('geolocation' in navigator)) return () => {};
  // On some browsers, watchPosition is throttled; we use poll+getCurrentPosition
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = async () => {
    if (stopped) return;
    const p = decidePerm('location');
    if (p !== 'allow') return;
    const pos = await getCurrentPosition(5000);
    if (pos) {
      try {
        window.dispatchEvent(new CustomEvent('bw:location:live', { detail: pos } as any));
      } catch {}
    }
  };

  timer = setInterval(tick, Math.max(5000, intervalMs));
  tick();

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  };
}

/* Compatibility shim (Availability.tsx older import) */
export async function fetchUserLocationOrRoute(opts?: { navigate?: (path: string) => void }): Promise<Coords | null> {
  const live = await ensureLocationAccess({
    navigate: opts?.navigate ?? ((path) => {
      try {
        window.location.href = path;
      } catch {}
    }),
  });
  if (live) return live;
  return readSavedCoords();
}

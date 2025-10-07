// /src/screens/availability/Availability.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AVAILABILITY_DUMMY,
  type RestaurantAvailability,
} from '../../data/availability';
import { getDishImage, placeholderDishUrl } from '../../lib/images';
import useCart from '../../store/cart';
import { DISH_CATALOG } from '../../data/dishCatalog';
import {
  decidePerm,
  setPermPolicy,
  allowForThisSession,
  type PermPolicy,
  usePermDecision,              // ✅ NEW: live permission hook
} from '../../lib/permPrefs';
import { addNotice } from '../../lib/notifications';

/* ---------- helpers & small atoms ---------- */
function formatCount(n?: number): string {
  if (!n || n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k+`;
  return `${n}`;
}
function bestPrice(r: RestaurantAvailability): number | undefined {
  const a = typeof r.swiggy.price === 'number' ? r.swiggy.price : undefined;
  const b = typeof r.zomato.price === 'number' ? r.zomato.price : undefined;
  if (typeof a === 'number' && typeof b === 'number') return Math.min(a, b);
  return a ?? b;
}
function bestEta(r: RestaurantAvailability): number | undefined {
  const a = typeof r.swiggy.etaMins === 'number' ? r.swiggy.etaMins : undefined;
  const b = typeof r.zomato.etaMins === 'number' ? r.zomato.etaMins : undefined;
  if (typeof a === 'number' && typeof b === 'number') return Math.min(a, b);
  return a ?? b;
}
function bestOfferText(r: RestaurantAvailability): string | undefined {
  const s = (r.swiggy as any)?.offerText as string | undefined;
  const z = (r.zomato as any)?.offerText as string | undefined;
  return s?.trim() || z?.trim() || undefined;
}
function RotatingDishImage({
  names, fallback, intervalMs = 3000,
}:{ names: string[]; fallback: string | undefined; intervalMs?: number; }) {
  const [idx, setIdx] = useState(0);
  const urls = useMemo(() => {
    const arr = names.map((n) => getDishImage(n, null)).filter(Boolean) as string[];
    if (arr.length === 0 && fallback) arr.push(fallback);
    if (arr.length === 0) arr.push(placeholderDishUrl());
    return arr;
  }, [names, fallback]);
  useEffect(() => {
    if (urls.length <= 1) return;
    const h = setInterval(() => setIdx((i) => (i + 1) % urls.length), intervalMs);
    return () => clearInterval(h);
  }, [urls, intervalMs]);
  return (
    <img
      src={urls[idx]}
      alt={`${names[idx] || 'dish'}`}
      className="w-full h-40 object-cover"
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        const ph = placeholderDishUrl();
        if (!el.src.endsWith(ph)) el.src = ph;
      }}
    />
  );
}
function Tile({
  r, matchedDishNames, onCompare,
}:{ r: RestaurantAvailability; matchedDishNames: string[]; onCompare: (r: RestaurantAvailability) => void; }) {
  const both = r.swiggy.available && r.zomato.available;
  const price = bestPrice(r);
  const eta = bestEta(r);
  const offer = bestOfferText(r);
  const reviewCount = (r as any).reviews ?? 0;
  return (
    <div className="relative rounded-2xl border bg-white shadow-sm overflow-hidden">
      <RotatingDishImage names={[matchedDishNames?.[0] || r.dishName]} fallback={r.heroImage} intervalMs={3000} />
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold line-clamp-2">{r.name}</h3>
          <div className="text-sm text-green-600 flex items-center gap-1">
            ⭐ {r.rating.toFixed(1)} <span className="opacity-60 text-xs">({formatCount(reviewCount)})</span>
          </div>
        </div>
        <div className="text-xs opacity-70 mb-1">{eta ? `${eta} mins` : '—'} • {r.distanceKm} km</div>
        <div className="text-sm font-medium">{typeof price === 'number' ? `₹${price}` : '—'}</div>
        {offer && <div className="text-xs text-rose-600 font-medium mt-1">{offer}</div>}
      </div>
      {both && (
        <button
          className="absolute right-3 top-3 text-xs px-3 py-1 rounded-full bg-black text-white"
          onClick={() => onCompare(r)}
          aria-label={`Compare ${r.name}`}
        >
          Compare
        </button>
      )}
      {typeof price === 'number' && (
        <div className="absolute left-3 top-3 text-xs px-2 py-1 rounded-full bg-black/60 text-white">₹{price}</div>
      )}
    </div>
  );
}

/* ---------- Permission blocker (Location denied) ---------- */
function LocationBlocked({
  onChoose,
}:{ onChoose: (choice: PermPolicy) => void; }) {
  return (
    <div className="rounded-2xl border bg-white/95 p-4 shadow">
      <p className="font-semibold mb-1">Location is blocked for BiteWise</p>
      <p className="text-sm opacity-70 mb-3">Choose how you want to share your location with BiteWise.</p>
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-1.5 rounded-full border bg-black text-white" onClick={() => onChoose('always')}>
          Always allow
        </button>
        <button className="px-3 py-1.5 rounded-full border" onClick={() => onChoose('session')}>
          Only this time
        </button>
        <button className="px-3 py-1.5 rounded-full border" onClick={() => onChoose('never')}>
          Don’t allow
        </button>
      </div>
      <div className="text-xs opacity-60 mt-2">You can change this later in Settings → Permissions.</div>
    </div>
  );
}

/* ---------- main screen ---------- */
export default function Availability() {
  const nav = useNavigate();

  // ✅ Live, reactive permission decision (updates after auto/manual logout)
  const perm = usePermDecision('location');

  // show a toast/inbox entry when blocked
  useEffect(() => {
    if (perm !== 'allow') {
      addNotice({
        kind: 'system',
        title: 'Location needed',
        body: 'Enable location to show best availability near you.',
      });
    }
  }, [perm]);

  // filters
  const DEFAULTS = { price: 1500, rating: 0, distance: 20 };
  const [priceMax, setPriceMax] = useState<number>(DEFAULTS.price);
  const [ratingMin, setRatingMin] = useState<number>(DEFAULTS.rating);
  const [distanceMax, setDistanceMax] = useState<number>(DEFAULTS.distance);

  // selected dishes from cart
  const { items } = useCart();
  const selectedDishNames = useMemo(() => {
    if (!items.length) return [];
    return items
      .map((id) => DISH_CATALOG.find((d) => String(d.id) === String(id))?.name?.trim())
      .filter(Boolean) as string[];
  }, [items]);

  // helpers for filtering
  function restaurantMenu(r: RestaurantAvailability): string[] {
    const menu = (r as any).dishes ?? [r.dishName].filter(Boolean);
    return menu.map((n) => String(n).toLowerCase());
  }
  function servesAny(r: RestaurantAvailability): boolean {
    const menu = restaurantMenu(r);
    return selectedDishNames.some((n) => menu.includes(n.toLowerCase()));
  }
  function matchedDishes(r: RestaurantAvailability): string[] {
    const menu = restaurantMenu(r);
    return selectedDishNames.filter((n) => menu.includes(n.toLowerCase()));
  }

  // filtered rows
  const rows = useMemo(() => {
    let list = AVAILABILITY_DUMMY.slice();
    if (selectedDishNames.length > 0) {
      const all = list.filter(servesAny);
      list = all.length > 0 ? all : list.filter(servesAny);
    }
    return list
      .map((r) => ({ r, matches: matchedDishes(r) }))
      .filter(({ r }) => {
        const price = bestPrice(r) ?? Infinity;
        const ratingOk = r.rating >= ratingMin;
        const priceOk = price <= priceMax;
        const distOk = r.distanceKm <= distanceMax;
        return ratingOk && priceOk && distOk;
      });
  }, [priceMax, ratingMin, distanceMax, selectedDishNames]);

  const resetFilters = () => {
    setPriceMax(DEFAULTS.price);
    setRatingMin(DEFAULTS.rating);
    setDistanceMax(DEFAULTS.distance);
  };

  // Handle permission choice from blocker
  function handlePermChoice(choice: PermPolicy) {
    if (choice === 'session') {
      allowForThisSession('location');
    } else {
      setPermPolicy('location', choice);
    }
    // perm state will auto-refresh via usePermDecision’s listeners
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400 pb-16">
      <div className="max-w-4xl mx-auto w-full px-3 pt-4">
        {/* header */}
        <div className="flex items-center justify-between mb-3">
          <button
            className="px-3 py-1.5 text-sm rounded-full border bg-white/80"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Check availability</h1>
          <div className="w-[96px]" />
        </div>

          <>
            {/* filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="rounded-2xl border bg-white/80 p-3">
                <div className="text-xs opacity-70 mb-1">Price ≤ ₹{priceMax}</div>
                <input
                  type="range"
                  min={50}
                  max={1500}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="rounded-2xl border bg-white/80 p-3">
                <div className="text-xs opacity-70 mb-1">Rating ≥ {ratingMin.toFixed(1)}</div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={ratingMin}
                  onChange={(e) => setRatingMin(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="rounded-2xl border bg-white/80 p-3">
                <div className="text-xs opacity-70 mb-1">Distance ≤ {distanceMax} km</div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={distanceMax}
                  onChange={(e) => setDistanceMax(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rows.map(({ r, matches }) => (
                <Tile
                  key={r.id}
                  r={r}
                  matchedDishNames={matches}
                  onCompare={(row) => nav(`/compare/${row.id}`)}
                />
              ))}
            </div>
          </>
        )
      </div>
    </main>
  );
}

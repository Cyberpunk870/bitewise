// /src/screens/compare/Compare.tsx
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AVAILABILITY_DUMMY, AVAILABILITY_MERGED, getAvailabilityForCity } from '../../data/availability';
import type { PriceBreakdown } from '../../data/availability';
import useCart from '../../store/cart';
import { emit } from '../../lib/events';
import { getLastAvailabilitySync, timeAgo } from '../../lib/dataSync';
import { startOutbound } from '../../lib/orderReturn';
import { markTtfRender, markDataEmpty, markDataError } from '../../lib/metricsClient';
import { track } from '../../lib/track';
import { addNotice } from '../../lib/notifications';
import { logError } from '../../lib/logger';
import GlassPanel from '../../components/GlassPanel';
import { getActiveProfile } from '../../lib/profileStore';

type Column = PriceBreakdown & {
  subtotal: number;
  total: number;
};

function calcTotals(p: PriceBreakdown): { subtotal: number; total: number } {
  const subtotal = p.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const fees = p.fees.packaging + p.fees.delivery + p.fees.platformFee + p.fees.tax;
  const savings = p.promo?.savings ?? 0;
  const total = Math.max(0, subtotal + fees - savings);
  return { subtotal, total };
}

function Block({
  title,
  children,
  tone = 'default',
  invert = false,
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'subtle';
  invert?: boolean;
}) {
  const toneClass = tone === 'subtle'
      ? invert
        ? 'bg-white/10 border-white/20 text-white'
        : 'bg-slate-50/90 border-slate-200/70 text-slate-900'
      : invert
        ? 'bg-white/15 border-white/30 text-white'
        : 'bg-white border-slate-100/80 text-slate-900';
  return (
    <div className={`rounded-xl ${toneClass} p-3 shadow-sm`}>
      <div className={`text-sm font-semibold mb-2 ${invert ? 'text-white' : 'text-slate-900'}`}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Money({ v }: { v: number }) {
  return <span>₹{v.toFixed(2)}</span>;
}

function openDeliveryApp(platform: string, webUrl: string) {
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  const fallback = webUrl || 'https://www.google.com/';
  const apps: Record<string, { scheme: string; intent?: string }> = {
    swiggy: {
      scheme: 'swiggy://open',
      intent: `intent://open#Intent;scheme=swiggy;package=in.swiggy.android;S.browser_fallback_url=${encodeURIComponent(fallback)};end`,
    },
    zomato: {
      scheme: 'zomato://order',
      intent: `intent://order#Intent;scheme=zomato;package=com.application.zomato;S.browser_fallback_url=${encodeURIComponent(fallback)};end`,
    },
  };

  const cfg = apps[platform] || { scheme: fallback };
  const goWeb = () => {
    window.location.href = fallback;
  };

  if (isAndroid && cfg.intent) {
    window.location.href = cfg.intent;
    setTimeout(goWeb, 900);
    return;
  }

  if (isIOS) {
    window.location.href = cfg.scheme;
    setTimeout(goWeb, 1000);
    return;
  }

  // desktop/unknown → web
  window.open(fallback, '_blank', 'noopener');
}

export default function Compare() {
  useEffect(() => { emit('bw:compare:opened', null); }, []);
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { items } = useCart();
  const t0Ref = useRef<number>(performance.now());

  const [lastSyncTs, setLastSyncTs] = useState<number | null>(() => getLastAvailabilitySync());
  useEffect(() => {
    const onSync = (e: Event) => setLastSyncTs((e as CustomEvent<number>).detail || Date.now());
    window.addEventListener('bw:data:availabilitySync' as any, onSync as any);
    return () => window.removeEventListener('bw:data:availabilitySync' as any, onSync as any);
  }, []);

  const restaurant = useMemo(() => {
    const profile = getActiveProfile();
    const cityList = getAvailabilityForCity(profile?.city);
    return (
      cityList.find((r) => String(r.id) === String(id)) ||
      AVAILABILITY_MERGED.find((r) => String(r.id) === String(id)) ||
      AVAILABILITY_DUMMY.find((r) => String(r.id) === String(id))
    );
  }, [id]);

  const selectedKeys = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach((it: any) => {
      const nm = String(it.name || '').toLowerCase();
      const id = String(it.id || '').toLowerCase();
      if (nm) set.add(nm);
      if (id) set.add(id);
    });
    return set;
  }, [items]);

  const columns: Column[] = useMemo(() => {
    if (!restaurant?.priceBreakdown?.length) return [];
    const hasFilter = selectedKeys.size > 0;
    return restaurant.priceBreakdown
      .map((p) => {
        const itemsToUse = p.items.filter((it: any) => {
          if (!hasFilter) return true;
          const nm = String(it.name || it.menu_id || '').toLowerCase();
          const id = String(it.menu_id || it.id || '').toLowerCase();
          return (nm && selectedKeys.has(nm)) || (id && selectedKeys.has(id));
        });
        if (hasFilter && itemsToUse.length === 0) return null;
        const filtered = { ...p, items: itemsToUse };
        const { subtotal, total } = calcTotals(filtered as any);
        return { ...(filtered as any), subtotal, total };
      })
      .filter((p): p is Column => Boolean(p));
  }, [restaurant, selectedKeys]);

  const cheaper =
    columns.length >= 2
      ? columns[0].total < columns[1].total
        ? columns[0].platform
        : columns[1].platform
      : columns[0]?.platform;

  const fastest =
    columns.length >= 2
      ? columns[0].etaMins < columns[1].etaMins
        ? columns[0].platform
        : columns[1].platform
      : columns[0]?.platform;

  useEffect(() => {
    const ms = performance.now() - t0Ref.current;
    markTtfRender('compare', ms);
    track('compare_open', { id, ttf_ms: ms });
  }, []);

  if (!restaurant) {
    markDataError('compare', 'not_found');
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button className="px-3 py-1.5 text-sm rounded-full border mb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700" onClick={() => nav(-1)}>← Back</button>
          <p>Restaurant not found.</p>
        </div>
      </main>
    );
  }

  if (!columns.length) {
    markDataEmpty('compare');
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button className="px-3 py-1.5 text-sm rounded-full border mb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700" onClick={() => nav(-1)}>← Back</button>
          <div className="rounded-2xl border p-4 bg-slate-50">
            <div className="font-semibold mb-1">{restaurant.name}</div>
            <div className="text-sm text-slate-600">
              No price breakdown available. Try refreshing later or pick another restaurant.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20 bg-gradient-to-br from-[#050915] via-[#0b1224] to-[#111e32] text-white">
      <div className="max-w-4xl mx-auto w-full px-4 pt-6">
        {/* header */}
        <div className="flex items-center justify-between mb-2">
          <button className="px-3 py-1.5 text-sm rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Compare prices</h1>
          <div className="text-[11px] text-white/90">
            Last updated: <b className="tabular-nums">{timeAgo(lastSyncTs)}</b>
          </div>
        </div>

        <GlassPanel tone="dark" className="mb-4">
          <div className="bw-heading text-lg">{restaurant.name}</div>
          <div className="bw-subtitle text-sm">
            Comparing {columns.length} platform{columns.length > 1 ? 's' : ''} • {items.length} selected item{items.length !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-white/60 mt-1">
            Best price is highlighted; “Fastest” shows the quickest ETA. Tap a card to open the app.
          </div>
        </GlassPanel>

        {/* two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {columns.map((c) => {
            const accent = PLATFORM_ACCENTS[c.platform.toLowerCase()] ?? PLATFORM_ACCENTS.default;
            const cheapestTotal = Math.min(...columns.map(x => x.total));
            const fastestEta = Math.min(...columns.map(x => x.etaMins));
            const priceDelta = c.total - cheapestTotal;
            const etaDelta = c.etaMins - fastestEta;
            return (
            <div
              key={c.platform}
              className={[
                'rounded-2xl bg-white/95 text-slate-900 p-4 shadow',
                cheaper === c.platform
                  ? 'ring-2 ring-emerald-500'
                  : 'ring-1 ring-slate-200/70',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${accent.badge}`}>
                    {c.platform}
                  </div>
                  <div className="text-sm opacity-70">{c.etaMins} mins</div>
                </div>
                <div className="flex items-center gap-2">
                  {cheaper === c.platform && (
                    <span className="text-xs font-semibold text-emerald-500">Best price</span>
                  )}
                  {fastest === c.platform && (
                    <span className="text-xs font-semibold text-sky-500">Fastest</span>
                  )}
                  {priceDelta !== 0 && (
                    <span className="text-[11px] px-2 py-1 rounded-full border bg-slate-100 text-slate-800">
                      {priceDelta > 0 ? `+₹${priceDelta.toFixed(0)}` : `₹${Math.abs(priceDelta).toFixed(0)} cheaper`}
                    </span>
                  )}
                  {etaDelta !== 0 && (
                    <span className="text-[11px] px-2 py-1 rounded-full border bg-slate-100 text-slate-800">
                      {etaDelta > 0 ? `+${etaDelta} mins` : `${Math.abs(etaDelta)} mins faster`}
                    </span>
                  )}
                </div>
              </div>

              {/* items */}
              <Block title="Items">
                {c.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="truncate">
                      {it.name} <span className="opacity-60">× {it.qty}</span>
                    </div>
                    <Money v={it.unitPrice * it.qty} />
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="font-medium">Subtotal</div>
                  <div className="font-medium"><Money v={c.subtotal} /></div>
                </div>
              </Block>

              {/* fees + promo */}
              <div className="grid grid-cols-2 gap-3 my-3">
                <Block title="Fees" tone="subtle">
                  <div className="flex items-center justify-between text-sm"><span>Packaging</span><Money v={c.fees.packaging} /></div>
                  <div className="flex items-center justify-between text-sm"><span>Delivery</span><Money v={c.fees.delivery} /></div>
                  <div className="flex items-center justify-between text-sm"><span>Platform</span><Money v={c.fees.platformFee} /></div>
                  <div className="flex items-center justify-between text-sm"><span>Taxes</span><Money v={c.fees.tax} /></div>
                </Block>

                <Block title="Promotions" tone="subtle">
                  {c.promo ? (
                    <>
                      <div className="text-sm">{c.promo.label}</div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Savings</span>
                        <span>-<Money v={c.promo.savings} /></span>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm opacity-60">No promo</div>
                  )}
                </Block>
              </div>

              {/* total */}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <div className="text-sm opacity-70">Total to pay</div>
                <div className="text-lg font-semibold"><Money v={c.total} /></div>
              </div>

              <button
  className={[
    'mt-3 w-full px-4 py-2 rounded-xl text-white',
    cheaper === c.platform ? 'bg-emerald-600' : accent.button,
  ].join(' ')}
  onClick={async () => {
    try {
      emit('bw:compare:done', { platform: c.platform, total: c.total });

      // ✅ compute other total for delta (to know how much cheaper)
      const other = columns.find(x => x.platform !== c.platform)?.total ?? c.total;
      track('compare_outbound', {
        platform: c.platform,
        total: c.total,
        otherTotal: other,
        delta: other - c.total,
        restaurant: restaurant.name,
      });

      // ✅ record outbound locally + on backend
      await startOutbound({
        ts: Date.now(),
        restaurantId: String(restaurant.id),
        restaurantName: restaurant.name,
        platform: c.platform as any,
        total: c.total,
        otherTotal: other,
        delta: other - c.total,             // positive = you saved
        tokenReward: 7,                     // adjust reward if needed
        deepLink: c.deepLink,
      });

      // finally open the food delivery app/site
      const webUrl = c.deepLink || (c.platform === 'swiggy'
        ? 'https://www.swiggy.com/'
        : c.platform === 'zomato'
          ? 'https://www.zomato.com/'
          : 'https://www.google.com/');
      openDeliveryApp(c.platform as string, webUrl);
    } catch (err) {
      logError('compare->order error', { err: String(err) }, { toast: true });
      addNotice({
        kind: 'system',
        title: 'Could not launch order',
        body: 'Please try again or open the delivery app manually.',
      });
    }
  }}
>
  Order on {c.platform[0].toUpperCase() + c.platform.slice(1)}
</button>
            </div>
          );
          })}
        </div>

        <div className="mt-4 text-sm text-white/80 space-y-1">
          <p>Tip: we highlight the cheaper option in green and surface the ETA so you instantly know which app to open.</p>
          <p className="text-white/60">Dummy timings/fees for now; live Actowiz data will plug in automatically.</p>
        </div>
      </div>
    </main>
  );
}
const PLATFORM_ACCENTS: Record<string, { badge: string; button: string; accentText: string }> = {
  swiggy: {
    badge: 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/30',
    button: 'bg-[#f97316] text-white',
    accentText: 'text-[#f97316] border-[#f97316]/30',
  },
  zomato: {
    badge: 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30',
    button: 'bg-[#ef4444] text-white',
    accentText: 'text-[#ef4444] border-[#ef4444]/30',
  },
  default: {
    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
    button: 'bg-black text-white',
    accentText: 'text-slate-700 border-slate-200',
  },
};

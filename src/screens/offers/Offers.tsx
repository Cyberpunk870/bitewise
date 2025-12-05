// src/screens/offers/Offers.tsx
import React, { useMemo } from 'react';
import { listActiveThemes } from '../../lib/seasonalThemes';
import { fetchThemesPublic, trackThemeEvent } from '../../lib/api';
import { DISH_CATALOG } from '../../data/dishCatalog';
import { getDishImage } from '../../lib/images';
import { useNavigate } from 'react-router-dom';

export default function Offers() {
  const nav = useNavigate();
  const [promos, setPromos] = React.useState(listActiveThemes());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchThemesPublic()
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data) && data.length) setPromos(data as any);
      })
      .catch(() => {
        setError('Could not load live offers.');
      });
    setLoading(false);
    return () => {
      alive = false;
    };
  }, []);

  const curated = useMemo(() => {
    // Prefer tagged deals; otherwise show a stable slice.
    const tagged = DISH_CATALOG.filter((d: any) =>
      (d.tags || []).some((t: string) => ['value', 'best', 'deal'].includes(t.toLowerCase()))
    );
    const pool = tagged.length ? tagged : DISH_CATALOG;
    return pool.slice(0, 8).map((d) => ({
      id: d.id,
      name: d.name,
      img: getDishImage(d.name, d.imageUrl || null),
      tags: d.tags || [],
    }));
  }, []);

  return (
    <main className="min-h-screen text-white pb-24 px-3">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between pt-6">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-white/60">Offers</div>
            <h1 className="text-3xl font-extrabold">Seasonal deals & coupons</h1>
            <p className="text-white/70 mt-1">Active promos, coupon codes, and value picks.</p>
          </div>
          <button
            onClick={() => nav(-1)}
            className="px-4 py-2 rounded-xl border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition"
          >
            ← Back
          </button>
        </div>

        {/* Promos */}
        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
              Loading offers…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-300/40 bg-rose-500/10 p-4 text-rose-100">
              {error}
            </div>
          ) : promos.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
              No live seasonal offers right now. Check back soon!
            </div>
          ) : (
            promos.map((p) => (
              <div
                key={p.name}
                className="rounded-2xl p-4 border border-white/10 shadow"
                style={{ background: p.gradient }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm uppercase tracking-[0.22em] text-white/70">{p.name}</div>
                    <div className="text-2xl font-extrabold">{p.heroTitle}</div>
                    <div className="text-sm text-white/80">{p.heroSubtitle}</div>
                    {p.promo ? (
                      <div className="mt-2 text-sm text-white/85">
                        <div className="font-semibold">{p.promo.title}</div>
                        {p.promo.body ? <div className="text-white/80">{p.promo.body}</div> : null}
                      </div>
                    ) : null}
                  </div>
                  {p.promo?.href ? (
                    <button
                      onClick={() => {
                        if (p.name) trackThemeEvent(p.name, 'click');
                        nav(p.promo!.href!);
                      }}
                      className="mt-2 sm:mt-0 px-4 py-2 rounded-xl font-semibold text-black"
                      style={{ backgroundColor: p.accent }}
                    >
                      {p.promo.ctaLabel || 'View menu'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Value picks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-white/60">Value picks</div>
              <div className="text-lg font-semibold">Handpicked dishes on offer</div>
            </div>
            <button
              onClick={() => nav('/home')}
              className="px-3 py-2 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/40 transition"
            >
              Browse all
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {curated.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow"
              >
                <div
                  className="h-40 bg-cover bg-center"
                  style={{ backgroundImage: `url(${d.img})` }}
                  aria-hidden
                />
                <div className="p-3 space-y-1">
                  <div className="font-semibold">{d.name}</div>
                  {d.tags?.length ? (
                    <div className="flex flex-wrap gap-1 text-xs text-white/70">
                      {d.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full border border-white/15 bg-white/5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    onClick={() => nav('/home')}
                    className="mt-2 text-sm font-semibold text-blue-100 hover:underline"
                  >
                    View in menu →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

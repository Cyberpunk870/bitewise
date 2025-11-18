// src/screens/home/sections/AnalyticsPeek.tsx
import React, { useEffect, useState } from 'react';
import { getAnalyticsSummary } from '../../../lib/api';

type Summary = {
  totals?: Record<string, number>;
  timeline?: Array<{ date: string; total: number }>;
};

const FOCUS_EVENTS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'login_success', label: 'Logins', hint: 'Past 7 days' },
  { key: 'compare_outbound', label: 'Comparisons', hint: 'Users checking prices' },
  { key: 'order_complete', label: 'Orders marked', hint: 'Savings captured' },
];

export default function AnalyticsPeek() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAnalyticsSummary(7)
      .then((res: any) => {
        if (!cancelled) setSummary(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Unable to load analytics.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = summary?.totals || {};

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-white shadow-lg shadow-black/30">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/60">Analytics pulse</p>
          <h3 className="text-xl font-semibold">Last 7 days</h3>
        </div>
        <span className="text-xs text-white/40">{summary?.sample ? `${summary.sample} events` : 'Live'}</span>
      </div>

      <div className="mt-4 space-y-3">
        {FOCUS_EVENTS.map((event) => (
          <div key={event.key} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 bg-white/5">
            <div>
              <p className="text-sm font-semibold">{event.label}</p>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">{event.hint}</p>
            </div>
            <p className="text-2xl font-bold">
              {typeof totals[event.key] === 'number' ? totals[event.key] : '—'}
            </p>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-rose-200">{error}</p>}
      {!summary && !error && <p className="mt-3 text-xs text-white/50">Fetching dashboard…</p>}
    </section>
  );
}

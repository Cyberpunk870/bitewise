// src/screens/admin/Analytics.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnalyticsSummary } from '../../lib/api';

type SummaryResponse = {
  ok: true;
  range: { days: number; since: number; until: number };
  totals: Record<string, number>;
  timeline: Array<{ date: string; total: number }>;
  sample: number;
};

const DAY_OPTIONS = [7, 14, 30];

export default function AnalyticsDashboard() {
  const nav = useNavigate();
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getAnalyticsSummary(days)
      .then((res: SummaryResponse) => {
        if (!alive) return;
        setSummary(res);
      })
      .catch((err: any) => {
        if (!alive) return;
        setError(err?.message || 'Failed to load analytics.');
        setSummary(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [days]);

  const totalEvents = useMemo(() => {
    if (!summary) return 0;
    return Object.values(summary.totals).reduce((acc, val) => acc + val, 0);
  }, [summary]);

  return (
    <main className="min-h-screen px-4 py-6 text-white">
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="flex items-center justify-between">
          <button
            className="px-3 py-1.5 text-sm rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <div>
            <h1 className="text-lg font-semibold">Analytics Dashboard</h1>
            <p className="text-xs text-white/60">Events captured via /api/ingest</p>
          </div>
          <div className="w-24 text-right text-sm text-white/70">
            {summary ? `${summary.sample} events` : ''}
          </div>
        </header>

        <section className="glass-card p-5 border border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            {DAY_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setDays(opt)}
                className={[
                  'px-3 py-1.5 rounded-full text-sm border transition',
                  days === opt
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-white/70 border-white/10',
                ].join(' ')}
              >
                Last {opt}d
              </button>
            ))}
          </div>

          {loading && <p className="text-sm text-white/70 mt-4">Loading…</p>}
          {error && !loading && <p className="text-sm text-red-400 mt-4">{error}</p>}

          {summary && !loading && !error && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">All events</p>
                <p className="text-3xl font-semibold mt-2">{totalEvents}</p>
              </div>
              {Object.entries(summary.totals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([name, count]) => (
                  <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">{name}</p>
                    <p className="text-2xl font-semibold mt-2">{count}</p>
                  </div>
                ))}
            </div>
          )}
        </section>

        {summary && !loading && !error && (
          <section className="glass-card p-5 border border-white/10">
            <h2 className="text-sm uppercase tracking-[0.3em] text-white/60 mb-2">Daily events</h2>
            <div className="space-y-2">
              {summary.timeline.length === 0 ? (
                <p className="text-sm text-white/70">No events in this range.</p>
              ) : (
                summary.timeline.map((row) => (
                  <div key={row.date} className="flex items-center gap-3">
                    <div className="text-sm text-white/70 w-28">{row.date}</div>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc]"
                        style={{ width: `${Math.min(100, (row.total / Math.max(1, totalEvents)) * 200)}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-sm">{row.total}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

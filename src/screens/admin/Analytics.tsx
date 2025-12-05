// src/screens/admin/Analytics.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnalyticsSummary } from '../../lib/api';
import { getAuth } from 'firebase/auth';

type SummaryResponse = {
  ok: true;
  range: { days: number; since: number; until: number };
  totals: Record<string, number>;
  categories?: Record<string, number>;
  timeline: Array<{ date: string; total: number }>;
  sample: number;
  funnels?: {
    onboarding: { start: number; completed: number };
    permissions: { allow: number; deny: number };
    searchToCart: { searches: number; cartAdds: number };
    push: { registered: number; failed: number };
    feedback: { submissions: number };
    errors: number;
  };
};

const DAY_OPTIONS = [7, 14, 30];

export default function AnalyticsDashboard() {
  const nav = useNavigate();
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [exporting, setExporting] = useState(false);

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

  const errorCount = useMemo(() => {
    if (summary?.funnels) return summary.funnels.errors;
    if (!summary) return 0;
    return Object.entries(summary.totals).reduce((acc, [name, count]) => {
      const n = name.toLowerCase();
      if (n.includes("error") || n.includes("timeout") || n.includes("failed")) return acc + count;
      return acc;
    }, 0);
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
          <div className="flex items-center gap-2">
            <div className="w-24 text-right text-sm text-white/70">
              {summary ? `${summary.sample} events` : ''}
            </div>
            <button
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  // Prefer admin secret header; fallback to bearer if the UI sets it globally.
                  const headers: Record<string, string> = {};
                  const secret = localStorage.getItem('admin.secret') || '';
                  if (secret) headers['x-admin-secret'] = secret;
                  // If no secret, try bearer token (admin claim)
                  if (!secret) {
                    const user = getAuth().currentUser;
                    if (user) {
                      const token = await user.getIdToken();
                      headers['Authorization'] = `Bearer ${token}`;
                    }
                  }
                  const res = await fetch(`/api/analytics/export?days=${days}`, { headers, credentials: 'include' });
                  if (!res.ok) throw new Error('export failed');
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analytics-${days}d.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err: any) {
                  setError(err?.message || 'Export failed');
                } finally {
                  setExporting(false);
                }
              }}
              className="px-3 py-1.5 text-sm rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Download CSV'}
            </button>
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
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Errors / timeouts</p>
                <p className="text-2xl font-semibold mt-2">{errorCount}</p>
              </div>
              {summary.categories
                ? Object.entries(summary.categories)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => (
                      <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">{name}</p>
                        <p className="text-2xl font-semibold mt-2">{count}</p>
                      </div>
                    ))
                : null}
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

        {summary && !loading && !error && summary.funnels && (
          <section className="glass-card p-5 border border-white/10 space-y-4">
            <h2 className="text-sm uppercase tracking-[0.3em] text-white/60">Key funnels</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                <p className="text-xs text-white/60">Onboarding completion</p>
                <p className="text-2xl font-semibold">
                  {summary.funnels.onboarding.completed}/{summary.funnels.onboarding.start || 1}
                </p>
                <p className="text-xs text-white/60">
                  {summary.funnels.onboarding.start
                    ? Math.round((summary.funnels.onboarding.completed / summary.funnels.onboarding.start) * 100)
                    : 0}
                  % reached finish
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                <p className="text-xs text-white/60">Search → cart</p>
                <p className="text-2xl font-semibold">
                  {summary.funnels.searchToCart.cartAdds}/{summary.funnels.searchToCart.searches || 1}
                </p>
                <p className="text-xs text-white/60">
                  {summary.funnels.searchToCart.searches
                    ? Math.round((summary.funnels.searchToCart.cartAdds / summary.funnels.searchToCart.searches) * 100)
                    : 0}
                  % conversion
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                <p className="text-xs text-white/60">Permission sentiment</p>
                <p className="text-2xl font-semibold">
                  {summary.funnels.permissions.allow} allow / {summary.funnels.permissions.deny} deny
                </p>
                <p className="text-xs text-white/60">Across location, notifications, mic</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                <p className="text-xs text-white/60">Push readiness</p>
                <p className="text-2xl font-semibold">
                  {summary.funnels.push.registered} ok / {summary.funnels.push.failed} failed
                </p>
                <p className="text-xs text-white/60">Web push token registration</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                <p className="text-xs text-white/60">Feedback received</p>
                <p className="text-2xl font-semibold">{summary.funnels.feedback.submissions}</p>
                <p className="text-xs text-white/60">Form + in-app reports</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
                <p className="text-xs text-white/60">Errors / timeouts</p>
                <p className="text-2xl font-semibold">{summary.funnels.errors}</p>
                <p className="text-xs text-white/60">Events containing error/fail/timeout</p>
              </div>
            </div>
          </section>
        )}

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

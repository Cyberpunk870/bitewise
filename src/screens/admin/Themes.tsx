// src/screens/admin/Themes.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';

type Promo = {
  title?: string;
  body?: string;
  ctaLabel?: string;
  href?: string;
};
type Theme = {
  id?: string;
  name: string;
  start: string;
  end: string;
  priority?: number;
  enabled?: boolean;
  accent: string;
  gradient: string;
  heroTitle: string;
  heroSubtitle: string;
  promo?: Promo;
  updated_at?: string;
};

const EMPTY_THEME: Theme = {
  name: '',
  start: '',
  end: '',
  priority: 0,
  enabled: true,
  accent: '#9df2ff',
  gradient: 'linear-gradient(135deg, #0f0a2c 0%, #1c1247 50%, #2a1a60 100%)',
  heroTitle: '',
  heroSubtitle: '',
  promo: { title: '', body: '', ctaLabel: 'View offers', href: '/offers' },
};

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = localStorage.getItem('admin.secret') || '';
  if (secret) headers['x-admin-secret'] = secret;
  if (!secret) {
    const user = getAuth().currentUser;
    if (user) headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
  }
  return headers;
}

export default function AdminThemes() {
  const nav = useNavigate();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [editing, setEditing] = useState<Theme>(EMPTY_THEME);
  const [saving, setSaving] = useState(false);

  const sortedThemes = useMemo(
    () => [...themes].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    [themes]
  );

  async function loadThemes() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/themes/list', {
        headers: await authHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'failed to load themes');
      setThemes(data.themes || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load themes');
      setThemes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThemes();
  }, []);

  async function saveTheme() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/themes/upsert', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(editing),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'save failed');
      await loadThemes();
      setEditing(EMPTY_THEME);
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTheme(id?: string) {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/themes/delete', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ id }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'delete failed');
      await loadThemes();
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

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
            <h1 className="text-lg font-semibold">Seasonal Themes</h1>
            <p className="text-xs text-white/60">Admin-managed promo slots</p>
          </div>
          <div className="w-28 text-right text-sm text-white/70">
            {loading ? 'Loading…' : `${themes.length} themes`}
          </div>
        </header>

        {error ? <div className="text-sm text-red-300">{error}</div> : null}

        <section className="glass-card p-4 border border-white/10 space-y-3">
          <div className="text-sm font-semibold">Edit / Create</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm"
              placeholder="Name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                type="date"
                className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm flex-1"
                value={editing.start}
                onChange={(e) => setEditing({ ...editing, start: e.target.value })}
              />
              <input
                type="date"
                className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm flex-1"
                value={editing.end}
                onChange={(e) => setEditing({ ...editing, end: e.target.value })}
              />
            </div>
            <input
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm"
              placeholder="Hero title"
              value={editing.heroTitle}
              onChange={(e) => setEditing({ ...editing, heroTitle: e.target.value })}
            />
            <input
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm"
              placeholder="Hero subtitle"
              value={editing.heroSubtitle}
              onChange={(e) => setEditing({ ...editing, heroSubtitle: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm flex-1"
                placeholder="Accent color"
                value={editing.accent}
                onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
              />
              <input
                className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm flex-1"
                placeholder="Priority (higher wins)"
                value={editing.priority ?? 0}
                onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value || 0) })}
              />
            </div>
            <textarea
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm sm:col-span-2"
              placeholder="Gradient CSS"
              value={editing.gradient}
              onChange={(e) => setEditing({ ...editing, gradient: e.target.value })}
            />
            <input
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm"
              placeholder="Promo title"
              value={editing.promo?.title || ''}
              onChange={(e) => setEditing({ ...editing, promo: { ...(editing.promo || {}), title: e.target.value } })}
            />
            <input
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm"
              placeholder="Promo body"
              value={editing.promo?.body || ''}
              onChange={(e) => setEditing({ ...editing, promo: { ...(editing.promo || {}), body: e.target.value } })}
            />
            <input
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm"
              placeholder="Promo CTA label"
              value={editing.promo?.ctaLabel || ''}
              onChange={(e) =>
                setEditing({ ...editing, promo: { ...(editing.promo || {}), ctaLabel: e.target.value } })
              }
            />
            <input
              className="px-3 py-2 rounded-xl bg-white/80 text-black text-sm"
              placeholder="Promo href"
              value={editing.promo?.href || ''}
              onChange={(e) => setEditing({ ...editing, promo: { ...(editing.promo || {}), href: e.target.value } })}
            />
            <div className="flex items-center gap-2">
              <input
                id="enabled"
                type="checkbox"
                checked={editing.enabled !== false}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
              <label htmlFor="enabled" className="text-sm">Enabled</label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={saving}
              onClick={saveTheme}
              className="px-3 py-1.5 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save theme'}
            </button>
            <button
              disabled={saving}
              onClick={() => setEditing(EMPTY_THEME)}
              className="px-3 py-1.5 rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-50"
            >
              Reset
            </button>
          </div>

          {/* Preview */}
          <div
            className="mt-4 rounded-2xl p-4 border border-white/10"
            style={{ background: editing.gradient }}
          >
            <div className="text-sm uppercase tracking-[0.2em] text-white/70">{editing.name || 'Name'}</div>
            <div className="text-2xl font-extrabold">{editing.heroTitle || 'Hero title'}</div>
            <div className="text-sm text-white/80">{editing.heroSubtitle || 'Subtitle'}</div>
            {editing.promo?.title ? (
              <div className="mt-2 text-sm text-white/85">
                <div className="font-semibold">{editing.promo.title}</div>
                {editing.promo.body ? <div className="text-white/80">{editing.promo.body}</div> : null}
              </div>
            ) : null}
            <button
              className="mt-3 px-4 py-2 rounded-xl font-semibold text-black"
              style={{ backgroundColor: editing.accent || '#fff' }}
            >
              {editing.promo?.ctaLabel || 'CTA'}
            </button>
          </div>
        </section>

        {/* Existing themes list */}
        <section className="glass-card p-4 border border-white/10 space-y-3">
          <div className="text-sm font-semibold">Existing</div>
          {sortedThemes.length === 0 ? (
            <div className="text-sm text-white/70">No themes yet.</div>
          ) : (
            <div className="grid gap-3">
              {sortedThemes.map((t) => (
                <div
                  key={t.id || t.name}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{t.name}</div>
                      {t.enabled === false ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-100">
                          Disabled
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-100">
                          Enabled
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-70">
                      {t.start} → {t.end} · Priority {t.priority ?? 0}
                    </div>
                    {t.updated_at ? (
                      <div className="text-[11px] opacity-60">Updated {t.updated_at}</div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 rounded-xl border border-white/20 hover:bg-white/10 text-sm"
                      onClick={() => setEditing({ ...t })}
                      disabled={saving}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-xl border border-red-300/40 text-red-200 hover:bg-red-500/10 text-sm"
                      onClick={() => deleteTheme(t.id)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

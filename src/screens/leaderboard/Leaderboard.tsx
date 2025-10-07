// src/screens/leaderboard/Leaderboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Scope = 'local' | 'global' | 'friends';
type Frame = 'today' | 'week' | 'month' | 'all';
type Row = { name: string; you?: boolean; tokens: number; compares: number; savings: number };

function currentUser(): Row {
  const tokens = Number(localStorage.getItem('bw.tokens') || '0');
  const compares = Number(localStorage.getItem('bw.stats.compares') || '0');
  const savings = Number(localStorage.getItem('bw.stats.savings') || '0');
  const name = localStorage.getItem('bw.profile.name') || 'You';
  return { name, you: true, tokens, compares, savings };
}

// seeding helpers
function seedOthers(scope: Scope, frame: Frame): Row[] {
  const base = scope === 'local' ? 1200 : 1800;
  const mul = frame === 'today' ? 0.05 : frame === 'week' ? 0.25 : frame === 'month' ? 0.8 : 1;
  const n = 9;
  return Array.from({ length: n }).map((_, i) => ({
    name: `${scope === 'friends' ? 'Friend' : 'User'} ${i + 1}`,
    tokens: Math.max(0, Math.round((base - i * 120) * mul)),
    compares: Math.round((30 - i * 2) * mul),
    savings: Math.max(0, Math.round((5000 - i * 300) * mul)),
  }));
}

function Medal({ rank }: { rank: number }) {
  const color = rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-gray-300' : 'bg-amber-700';
  return <span className={`inline-block w-3 h-3 rounded-full ${color}`} aria-hidden />;
}

export default function Leaderboard() {
  const nav = useNavigate();
  const [scope, setScope] = useState<Scope>('local');
  const [frame, setFrame] = useState<Frame>('month');

  // contacts picker
  const [friendsSeed, setFriendsSeed] = useState<Row[] | null>(null);
  async function pickContacts() {
    // Web Contacts (secure contexts only, limited browsers). Fallback: explain to user.
    const anyNav: any = navigator as any;
    if (anyNav?.contacts?.select) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const contacts = await anyNav.contacts.select(props, opts);
        // lightweight fake: turn contacts into seeded rows
        const rows: Row[] = (contacts || []).slice(0, 10).map((c: any, i: number) => ({
          name: (c.name?.[0] || c.name || `Friend ${i + 1}`),
          tokens: 400 + Math.round(Math.random() * 600),
          compares: 2 + Math.round(Math.random() * 30),
          savings: 200 + Math.round(Math.random() * 2500),
        }));
        setFriendsSeed(rows);
      } catch (e) {
        alert('Could not access contacts. You can try again or use default friends.');
      }
    } else {
      alert('Your browser does not support Contacts Picker. We will show a sample friends board for now.');
      setFriendsSeed(seedOthers('friends', frame));
    }
  }

  // sticky choices
  useEffect(() => {
    const s = (localStorage.getItem('bw.lb.scope') as Scope) || 'local';
    const f = (localStorage.getItem('bw.lb.frame') as Frame) || 'month';
    setScope(s); setFrame(f);
  }, []);
  useEffect(() => { localStorage.setItem('bw.lb.scope', scope); }, [scope]);
  useEffect(() => { localStorage.setItem('bw.lb.frame', frame); }, [frame]);

  const rows = useMemo(() => {
    const me = currentUser();
    const base = scope === 'friends' ? (friendsSeed || seedOthers('friends', frame)) : seedOthers(scope, frame);
    return [me, ...base].sort((a, b) => (b.tokens - a.tokens) || (b.savings - a.savings));
  }, [scope, frame, friendsSeed]);
  const myRank = rows.findIndex(r => r.you) + 1;

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <button className="px-3 py-1.5 text-sm rounded-full border bg-white/80" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Leaderboard</h1>
          <div className="w-16" />
        </header>

        {/* scope + timeframe */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(['local','global','friends'] as Scope[]).map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-full text-sm border ${scope===s?'bg-black text-white border-black':'bg-white/80'}`}>
              {s === 'local' ? 'Local' : s === 'global' ? 'Global' : 'Friends'}
            </button>
          ))}
          <span className="mx-2 opacity-60">•</span>
          {(['today','week','month','all'] as Frame[]).map(f => (
            <button key={f} onClick={() => setFrame(f)}
              className={`px-3 py-1.5 rounded-full text-sm border ${frame===f?'bg-black text-white border-black':'bg-white/80'}`}>
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
          <div className="ml-auto text-white/90 text-sm">Your rank: <b>#{myRank}</b></div>
        </div>

        {scope === 'friends' && (
          <div className="mb-3">
            <button onClick={pickContacts} className="px-3 py-1.5 rounded-full bg-white/90 border text-sm">
              {friendsSeed ? 'Refresh friends' : 'Connect contacts'}
            </button>
            <span className="text-xs text-white/90 ml-2">We only read names/numbers locally to build your friends board.</span>
          </div>
        )}

        {/* table */}
        <div className="rounded-xl overflow-hidden bg-white shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/5 text-left">
                <th className="py-2 px-3">Rank</th>
                <th className="py-2 px-3">User</th>
                <th className="py-2 px-3">Tokens</th>
                <th className="py-2 px-3">Compares</th>
                <th className="py-2 px-3">Savings (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name + i} className={`border-t ${r.you ? 'bg-yellow-50' : ''}`}>
                  <td className="py-2 px-3">
                    {i < 3 ? <Medal rank={i+1} /> : i+1}
                  </td>
                  <td className="py-2 px-3">
                    {r.name}{r.you ? ' (you)' : ''}
                  </td>
                  <td className="py-2 px-3">{r.tokens}</td>
                  <td className="py-2 px-3">{r.compares}</td>
                  <td className="py-2 px-3">{r.savings.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-white/90 mt-3">
          Friends uses your device contacts (when supported). All data stays on-device for the MVP.
        </p>
      </div>
    </main>
  );
}

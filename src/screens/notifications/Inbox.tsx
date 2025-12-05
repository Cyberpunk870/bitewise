// src/screens/notifications/Inbox.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPermPolicy } from '../../lib/permPrefs';
import { getInbox, setInbox, markAllRead, clearAll } from '../../lib/notifications';
import type { Notice } from '../../lib/notifications';
import { track } from '../../lib/track';

export default function Inbox() {
  const nav = useNavigate();
  const [list, setList] = useState<Notice[]>(() => getInbox());

  useEffect(() => { track('inbox_view'); }, []);

  useEffect(() => setInbox(list), [list]);

  const unread = useMemo(() => list.filter(n => !n.read).length, [list]);
  const policy = getPermPolicy('notifications'); // 'always' | 'session' | 'never' | 'ask'

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <button
            className="px-3 py-1.5 text-sm rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 transition"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Notifications</h1>
          <div className="text-white/80 text-sm">{unread > 0 ? `${unread} unread` : ''}</div>
        </header>

        {policy !== 'always' && (
          <div className="glass-card p-4 text-white space-y-1">
            <div className="font-medium">
              Notifications are {policy === 'never' ? 'off' : 'limited'}.
            </div>
            <div className="text-sm text-white/70">
              Current choice: <b>{policy}</b>. Change in browser settings or re-run onboarding.
            </div>
          </div>
        )}

        <div className="glass-card divide-y divide-white/10">
          {list.length === 0 ? (
            <div className="p-6 text-sm text-center text-white/60">No notifications yet.</div>
          ) : (
            list.map(n => (
              <div key={n.id} className="p-4 flex items-start gap-3">
                <div className="mt-1 text-xs w-24 shrink-0 text-white/50">{new Date(n.ts).toLocaleString()}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{n.title}</div>
                  {n.body && <div className="text-sm text-white/80">{n.body}</div>}
                  {!n.read && (
                    <button
                      className="mt-1 text-xs underline text-white/60 hover:text-white"
                      onClick={() => setList(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                    >
                      Mark read
                    </button>
                  )}
                </div>
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-white/10 border border-white/20 text-white capitalize">
                  {n.kind}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            className="px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 text-white disabled:opacity-40"
            onClick={() => { markAllRead(); setList(getInbox()); }}
            disabled={unread === 0}
          >
            Mark all read
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc] text-[#0b1120] font-semibold disabled:opacity-40"
            onClick={() => { clearAll(); setList(getInbox()); }}
            disabled={list.length === 0}
          >
            Clear all
          </button>
        </div>
      </div>
    </main>
  );
}

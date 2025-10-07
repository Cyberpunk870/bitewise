// src/screens/notifications/Inbox.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPermPolicy } from '../../lib/permPrefs';
import { getInbox, setInbox, markAllRead, clearAll } from '../../lib/notifications';
import type { Notice } from '../../lib/notifications';

export default function Inbox() {
  const nav = useNavigate();
  const [list, setList] = useState<Notice[]>(() => getInbox());

  useEffect(() => setInbox(list), [list]);

  const unread = useMemo(() => list.filter(n => !n.read).length, [list]);
  const policy = getPermPolicy('notifications'); // 'always' | 'session' | 'never' | 'ask'

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <button className="px-3 py-1.5 text-sm rounded-full border bg-white/80" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Notifications</h1>
          <div className="text-white/90 text-sm">{unread > 0 ? `${unread} unread` : ''}</div>
        </header>

        {policy !== 'always' && (
          <div className="rounded-xl p-3 mb-3 bg-white shadow">
            <div className="font-medium">Notifications are {policy === 'never' ? 'off' : 'limited'}.</div>
            <div className="text-sm opacity-70">
              Current choice: <b>{policy}</b>. Change in browser settings or re-run onboarding.
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white shadow divide-y">
          {list.length === 0 ? (
            <div className="p-6 text-sm text-center text-gray-500">No notifications yet.</div>
          ) : (
            list.map(n => (
              <div key={n.id} className="p-3 flex items-start gap-3">
                <div className="mt-1 text-xs w-24 shrink-0 opacity-60">{new Date(n.ts).toLocaleString()}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-sm opacity-80">{n.body}</div>}
                  {!n.read && (
                    <button
                      className="mt-1 text-xs underline opacity-70"
                      onClick={() => setList(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                    >
                      Mark read
                    </button>
                  )}
                </div>
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-black/80 text-white capitalize">{n.kind}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button className="px-3 py-1.5 rounded-xl border bg-white" onClick={() => { markAllRead(); setList(getInbox()); }} disabled={unread === 0}>
            Mark all read
          </button>
          <button className="px-3 py-1.5 rounded-xl bg-black text-white" onClick={() => { clearAll(); setList(getInbox()); }} disabled={list.length === 0}>
            Clear all
          </button>
        </div>
      </div>
    </main>
  );
}

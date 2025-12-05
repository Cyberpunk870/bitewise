// src/screens/settings/NotificationsPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { emit } from '../../lib/events';

const loadNotify = () => import('../../lib/notify');

type Status = 'unsupported' | 'default' | 'granted' | 'denied';

function readPermission(): Status {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  const perm = (Notification as any).permission as NotificationPermission | undefined;
  if (!perm) return 'unsupported';
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'default';
}

export default function NotificationsPanel() {
  const [status, setStatus] = useState<Status>(readPermission());
  const [busy, setBusy] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('bw.push.lastAttempt');
    if (stored) setLastAttempt(stored);
    const err = localStorage.getItem('bw.push.lastError');
    if (err) setLastError(err);
  }, []);

  const refreshStatus = () => setStatus(readPermission());

  const onRequest = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const perm = await (Notification as any).requestPermission?.();
      setStatus((perm as any) || readPermission());
      const ts = new Date().toLocaleString();
      localStorage.setItem('bw.push.lastAttempt', ts);
      setLastAttempt(ts);
      if (perm === 'granted') {
        const { initOrRefreshPushOnAuth } = await loadNotify();
        await initOrRefreshPushOnAuth().catch((err) => {
          const msg = (err as any)?.message || 'Registration failed';
          localStorage.setItem('bw.push.lastError', msg);
          setLastError(msg);
        });
        emit('bw:toast', { title: 'Notifications enabled', body: 'You will receive updates.' });
      } else if (perm === 'denied') {
        emit('bw:toast', { title: 'Notifications blocked', body: 'Enable in browser settings and retry.' });
      }
    } catch (err) {
      const msg = (err as any)?.message || 'Request failed';
      setLastError(msg);
      localStorage.setItem('bw.push.lastError', msg);
      emit('bw:toast', { title: 'Notification setup failed', body: msg });
    } finally {
      setBusy(false);
      refreshStatus();
    }
  };

  const onSendTest = async () => {
    const { sendLocalTestNotification } = await loadNotify();
    const ok = await sendLocalTestNotification();
    if (ok) emit('bw:toast', { title: 'Test sent', body: 'Check your notifications.' });
    else emit('bw:toast', { title: 'Test failed', body: 'Permission missing or blocked.' });
  };

  const label =
    status === 'granted'
      ? 'Notifications on'
      : status === 'denied'
      ? 'Notifications blocked'
      : status === 'unsupported'
      ? 'Not supported'
      : 'Enable notifications';

  const badge = useMemo(() => {
    if (status === 'granted')
      return { text: 'Enabled', color: 'text-emerald-700 bg-emerald-100 dark:text-emerald-100 dark:bg-emerald-500/20 border border-emerald-500/30' };
    if (status === 'denied')
      return { text: 'Blocked', color: 'text-rose-700 bg-rose-100 dark:text-rose-100 dark:bg-rose-500/20 border border-rose-500/30' };
    if (status === 'unsupported')
      return { text: 'Unsupported', color: 'text-slate-700 bg-slate-100 dark:text-slate-200 dark:bg-slate-500/20 border border-slate-500/30' };
    return { text: 'Off', color: 'text-amber-700 bg-amber-100 dark:text-amber-100 dark:bg-amber-500/20 border border-amber-500/30' };
  }, [status]);

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/10 border border-white/15 p-4 shadow text-sm text-slate-900 dark:text-white">
      <div className="flex items-center justify-between mb-2 gap-3">
        <div>
          <div className="text-base font-semibold">Notifications</div>
          <div className="text-xs text-slate-600 dark:text-white/70">Toggle push and send a test.</div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.color}`}>{badge.text}</span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/20 bg-black/10 dark:bg-white/15 text-sm font-semibold text-slate-900 dark:text-white hover:bg-black/15 dark:hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
          onClick={onRequest}
          disabled={busy || status === 'unsupported'}
        >
          {busy ? 'Working…' : label}
        </button>
        <button
          className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/20 bg-white/70 dark:bg-white/10 text-sm font-semibold text-slate-900 dark:text-white hover:bg-white/90 dark:hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
          onClick={onSendTest}
          disabled={status !== 'granted'}
        >
          Send test
        </button>
      </div>

      <div className="text-[11px] text-slate-700 dark:text-white/70 space-y-0.5">
        <div>Permission: <span className="font-semibold">{status}</span></div>
        <div>Last attempt: {lastAttempt || '—'}</div>
        <div>Last error: {lastError || '—'}</div>
      </div>
    </div>
  );
}

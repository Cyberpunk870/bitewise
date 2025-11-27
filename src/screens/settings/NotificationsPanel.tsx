// src/screens/settings/NotificationsPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { initOrRefreshPushOnAuth, sendLocalTestNotification } from '../../lib/notify';
import { emit } from '../../lib/events';

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
    if (status === 'granted') return { text: 'Enabled', color: 'text-emerald-600 bg-emerald-100' };
    if (status === 'denied') return { text: 'Blocked', color: 'text-rose-600 bg-rose-100' };
    if (status === 'unsupported') return { text: 'Unsupported', color: 'text-slate-600 bg-slate-100' };
    return { text: 'Off', color: 'text-amber-700 bg-amber-100' };
  }, [status]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Notifications</div>
          <div className="text-xs text-slate-600">Toggle push and send a test.</div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.color}`}>{badge.text}</span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-60"
          onClick={onRequest}
          disabled={busy || status === 'unsupported'}
        >
          {busy ? 'Working…' : label}
        </button>
        <button
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-60"
          onClick={onSendTest}
          disabled={status !== 'granted'}
        >
          Send test
        </button>
      </div>

      <div className="text-[11px] text-slate-600 space-y-0.5">
        <div>Permission: {status}</div>
        <div>Last attempt: {lastAttempt || '—'}</div>
        <div>Last error: {lastError || '—'}</div>
      </div>
    </div>
  );
}

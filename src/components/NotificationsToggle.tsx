// src/components/NotificationsToggle.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { initOrRefreshPushOnAuth } from '../lib/notify';
import { emit } from '../lib/events';

type Status = 'default' | 'granted' | 'denied' | 'unsupported' | 'pending' | 'error';

function readPermission(): Status {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  const perm = (Notification as any).permission as NotificationPermission | undefined;
  if (!perm) return 'unsupported';
  if (perm === 'default') return 'default';
  if (perm === 'granted') return 'granted';
  if (perm === 'denied') return 'denied';
  return 'default';
}

export default function NotificationsToggle() {
  const [status, setStatus] = useState<Status>(readPermission());
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(() => setStatus(readPermission()), []);

  useEffect(() => {
    refreshStatus();
    const onFocus = () => refreshStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshStatus]);

  const request = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (status === 'unsupported') {
        emit('bw:toast', { title: 'Notifications unavailable', body: 'This browser does not support push notifications.' });
        return;
      }
      const perm = await (Notification as any).requestPermission?.();
      setStatus((perm as any) || readPermission());
      if (perm === 'granted') {
        await initOrRefreshPushOnAuth().catch(() => {});
        emit('bw:toast', { title: 'Notifications on', body: 'You will receive BiteWise updates.' });
      } else if (perm === 'denied') {
        emit('bw:toast', { title: 'Notifications blocked', body: 'Enable notifications in browser settings.' });
      }
    } catch (err) {
      setStatus('error');
      emit('bw:toast', { title: 'Notification setup failed', body: String((err as any)?.message || 'Unknown error') });
    } finally {
      setBusy(false);
    }
  };

  const label =
    status === 'granted'
      ? 'Notifications on'
      : status === 'denied'
      ? 'Notifications blocked'
      : status === 'unsupported'
      ? 'Not supported'
      : 'Enable notifications';

  const tone =
    status === 'granted'
      ? 'bg-emerald-500/90 text-white border-emerald-400'
      : status === 'denied' || status === 'error'
      ? 'bg-rose-500/90 text-white border-rose-400'
      : 'bg-white/90 text-slate-900 border-slate-200';

  return (
    <div className="fixed bottom-20 left-3 z-40 max-w-xs">
      <button
        aria-label="Toggle notifications"
        className={`w-full rounded-2xl px-3 py-2 shadow-md border text-sm font-semibold transition ${tone} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900`}
        onClick={request}
        disabled={busy || status === 'unsupported'}
      >
        {busy ? 'Checking…' : label}
      </button>
      {status === 'denied' && (
        <div className="mt-1 text-[11px] text-white/80">
          Enable in browser settings and tap again.
        </div>
      )}
    </div>
  );
}

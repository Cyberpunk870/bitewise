import React, { useEffect, useState } from 'react';
import { sendLocalTestNotification, initOrRefreshPushOnAuth } from '../../lib/notify';
import { toast } from '../../store/toast';
import { track } from '../../lib/track';

export default function PushStatus() {
  const [status, setStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [reason, setReason] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Best-effort ping of registration
    refresh();
  }, []);

  async function refresh() {
    setBusy(true);
    try {
      await initOrRefreshPushOnAuth();
      setStatus('ok');
      setReason('');
    } catch (err: any) {
      setStatus('error');
      setReason(err?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white">Push status</span>
        <span className={status === 'ok' ? 'text-emerald-300' : 'text-amber-200'}>
          {status === 'ok' ? 'Registered' : status === 'error' ? 'Needs attention' : 'Checking…'}
        </span>
      </div>
      {reason && <div className="text-xs text-amber-200">{reason}</div>}
      <div className="flex gap-2">
        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/20 transition disabled:opacity-50"
          onClick={refresh}
          disabled={busy}
        >
          {busy ? 'Refreshing…' : 'Refresh token'}
        </button>
        <button
          className="rounded-lg border border-white/15 px-3 py-2 text-white hover:bg-white/10 transition disabled:opacity-50"
          onClick={async () => {
            const ok = await sendLocalTestNotification();
            if (ok) {
              toast.success('Test notification sent.');
              track('push_test_local', {});
            } else {
              toast.error('Could not show a test notification. Check browser permissions.');
            }
          }}
        >
          Send test
        </button>
      </div>
      <div className="text-[11px] text-white/60">
        If registration fails, ensure notifications are allowed in your browser and refresh.
      </div>
    </div>
  );
}

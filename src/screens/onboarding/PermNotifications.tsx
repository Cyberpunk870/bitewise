// src/screens/onboarding/PermNotifications.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gateNotifications } from '../../lib/permGate';
import {
  decidePerm,
  setPermPolicy,
  allowForThisSession,
  type PermDecision,
} from '../../lib/permPrefs';
import { emit } from '../../lib/events';

export default function PermNotifications() {
  const nav = useNavigate();
  const loc = useLocation();

  // Came from Unlock pre-nudge (so don’t auto-nudge again)
  const prenudged = sessionStorage.getItem('bw.perm.prenudge') === '1';
  useEffect(() => {
    try { sessionStorage.removeItem('bw.perm.prenudge'); } catch {}
  }, []);

  const [dec, setDec] = useState<PermDecision>(() => decidePerm('notifications'));
  const [busy, setBusy] = useState(false);

  // Correct unsupported detection
  const unsupported = useMemo(() => {
    const g = gateNotifications();
    return !g.ok && g.reason === 'unsupported';
  }, []);

  // Debug
  try { console.log('[Perm/Notifications] gate =', gateNotifications()); } catch {}

  // Skip ahead if already allowed
  useEffect(() => {
    if (dec === 'allow') {
      setTimeout(() => nav('/onboarding/perm/mic', { replace: true }), 0);
    }
  }, [dec, nav]);

  // Auto-nudge when arriving from unlock/resume (unless we already prenudged)
  useEffect(() => {
    const from = new URLSearchParams(loc.search).get('from');
    if (from && dec === 'ask' && !unsupported && !prenudged) {
      const id = setTimeout(() => nudgeNativePrompt().catch(() => {}), 250);
      return () => clearTimeout(id);
    }
  }, [loc.search, dec, unsupported, prenudged]);

  async function nudgeNativePrompt() {
    try {
      if ('Notification' in window && (Notification as any).requestPermission) {
        const res = await (Notification as any).requestPermission();
        if (res === 'granted') allowForThisSession('notifications');
        emit('bw:perm:changed', null);
        setDec(decidePerm('notifications'));
      }
    } catch {
      // no-op
    }
  }

  async function chooseAlways() {
    setBusy(true);
    try {
      setPermPolicy('notifications', 'always');
      await nudgeNativePrompt();
      emit('bw:perm:changed', null);
      setDec(decidePerm('notifications'));
      nav('/onboarding/perm/mic', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function chooseSession() {
    setBusy(true);
    try {
      allowForThisSession('notifications');
      await nudgeNativePrompt();
      emit('bw:perm:changed', null);
      setDec(decidePerm('notifications'));
      nav('/onboarding/perm/mic', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  function chooseNever() {
    setPermPolicy('notifications', 'never');
    emit('bw:perm:changed', null);
    setDec(decidePerm('notifications'));
    nav('/onboarding/perm/mic', { replace: true });
  }

  // ---- Option A: Send test notification ----
  function showLocalTestNotification() {
    try {
      new Notification('🍔 BiteWise Test', {
        body: 'Looks like notifications work!',
        silent: false,
      });
    } catch {
      // If constructing Notification fails, silently ignore
    }
  }

  async function sendTestNotification() {
    if (unsupported || !('Notification' in window)) {
      alert('Notifications are not supported on this browser.');
      return;
    }

    // If already granted, show immediately
    if ((Notification as any).permission === 'granted') {
      showLocalTestNotification();
      return;
    }

    // Otherwise, ask once and then show if granted
    try {
      const res = await (Notification as any).requestPermission?.();
      if (res === 'granted') {
        allowForThisSession('notifications');
        emit('bw:perm:changed', null);
        setDec(decidePerm('notifications'));
        showLocalTestNotification();
      } else if (res === 'denied') {
        // Friendly nudge if blocked
        try {
          window.dispatchEvent(new CustomEvent('bw:toast', {
            detail: { title: 'Notifications blocked', body: 'Please allow notifications in your browser settings.' }
          } as any));
        } catch {}
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-6 space-y-5 shadow-lg animate-fade-up">
        <h1 className="text-2xl font-bold">Enable Notifications</h1>
        <p className="text-sm text-gray-600">
          Get price drops, order updates, and task rewards instantly.
        </p>

        {unsupported && (
          <div className="rounded-xl border p-3 text-sm">
            Notifications aren’t supported in this browser. You can continue.
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={chooseAlways}
            disabled={busy || unsupported}
            className="w-full rounded-xl bg-black text-white py-3 disabled:opacity-50"
          >
            Always allow
          </button>
          <button
            onClick={chooseSession}
            disabled={busy || unsupported}
            className="w-full rounded-xl border py-3 disabled:opacity-50"
          >
            Only this time
          </button>
          <button
            onClick={chooseNever}
            disabled={busy}
            className="w-full rounded-xl border py-3"
          >
            Don’t allow
          </button>
        </div>

        {/* Test notification CTA (visible even before grant; it will request permission if needed) */}
        {!unsupported && (
          <button
            onClick={sendTestNotification}
            className="w-full rounded-xl border py-2 mt-2"
            title="Send a local test notification"
          >
            Send test notification
          </button>
        )}

        <p className="text-xs text-gray-500">You can change this later in Settings.</p>
      </div>
    </div>
  );
}
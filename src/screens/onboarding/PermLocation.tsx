// src/screens/onboarding/PermLocation.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gateLocation } from '../../lib/permGate';
import {
  decidePerm,
  setPermPolicy,
  allowForThisSession,
  type PermDecision,
} from '../../lib/permPrefs';
import { getCurrentPosition } from '../../lib/location';
import { emit } from '../../lib/events';

export default function PermLocation() {
  const nav = useNavigate();
  const loc = useLocation();
  const prenudged = sessionStorage.getItem('bw.perm.prenudge') === '1';
  useEffect(() => {
  try { sessionStorage.removeItem('bw.perm.prenudge'); } catch {}
  }, []);
  const [dec, setDec] = useState<PermDecision>(() => decidePerm('location'));
  const [busy, setBusy] = useState(false);

  // Treat only explicit "unsupported" as unsupported
  const unsupported = useMemo(() => {
    const g = gateLocation();
    return !g.ok && g.reason === 'unsupported';
  }, []);

  // Helpful debug
  console.log('[Perm/Location] gate =', gateLocation());

  // If already allowed (Always or Session), skip forward
  useEffect(() => {
    if (dec === 'allow') {
      setTimeout(() => nav('/onboarding/perm/notifications', { replace: true }), 0);
    }
  }, [dec, nav]);

  // Auto-nudge the native prompt when arriving from unlock/resume
  useEffect(() => {
    const from = new URLSearchParams(loc.search).get('from');
    if (from && dec === 'ask' && !unsupported && !prenudged) {
      const id = setTimeout(() => nudgeNativePrompt().catch(() => {}), 250);
      return () => clearTimeout(id);
    }
  }, [loc.search, dec, unsupported]);

  async function nudgeNativePrompt() {
    try {
      await getCurrentPosition(5000); // triggers browser sheet; ignore errors
      allowForThisSession('location'); // harmless if denied
      emit('bw:perm:changed', null);
      setDec(decidePerm('location'));
    } catch {
      // user may have denied/cancelled
    }
  }

  async function chooseAlways() {
    setBusy(true);
    try {
      setPermPolicy('location', 'always');
      await nudgeNativePrompt();
      emit('bw:perm:changed', null);
      setDec(decidePerm('location'));
      nav('/onboarding/perm/notifications', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function chooseSession() {
    setBusy(true);
    try {
      allowForThisSession('location');
      await nudgeNativePrompt();
      emit('bw:perm:changed', null);
      setDec(decidePerm('location'));
      nav('/onboarding/perm/notifications', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  function chooseNever() {
    setPermPolicy('location', 'never');
    emit('bw:perm:changed', null);
    setDec(decidePerm('location'));
    nav('/onboarding/perm/notifications', { replace: true });
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-6 space-y-5 shadow-lg animate-fade-up">
        <h1 className="text-2xl font-bold">Allow Location</h1>
        <p className="text-sm text-gray-600">
          We use your location to find nearby restaurants and accurate delivery estimates.
        </p>

        {unsupported && (
          <div className="rounded-xl border p-3 text-sm">
            Your browser doesn’t support geolocation. You can continue without it.
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

        <p className="text-xs text-gray-500">You can change this later in Settings.</p>
      </div>
    </div>
  );
}
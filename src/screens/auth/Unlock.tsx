// src/screens/auth/Unlock.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasLocalPasskey, verifyLocalPasskey } from '../../lib/passkeyLocal';
import { getActiveProfile, getLastRoute } from '../../lib/profileStore';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { hydrateActiveFromCloud } from '../../lib/cloudProfile';

export default function Unlock() {
  const nav = useNavigate();
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Best candidate phone to unlock for
  const phone = useMemo(() => {
    try {
      const fromSession = sessionStorage.getItem('bw.session.phone') || '';
      if (fromSession) return fromSession;
      const last = localStorage.getItem('bw.lastPhone') || '';
      if (last) return last;
      const active = getActiveProfile();
      return active?.phone || '';
    } catch {
      return '';
    }
  }, []);

  const hasPasskeyFlag = useMemo(
    () => (phone ? hasLocalPasskey(phone) : false),
    [phone]
  );

  useEffect(() => {
    // Autofocus for nice UX
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  // compute safe return route
  function computeBackRoute(): string {
    try {
      const backRaw =
        getLastRoute() ||
        sessionStorage.getItem('bw.lastRoute') ||
        '';
      if (
        backRaw &&
        !backRaw.startsWith('/onboarding') &&
        !backRaw.startsWith('/auth') &&
        backRaw !== '/unlock'
      ) {
        return backRaw;
      }
    } catch {}
    return '/home';
  }

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();

    if (!phone) {
      toast.error('No account hint found. Please log in again.');
      nav('/onboarding', { replace: true });
      return;
    }

    if (!hasPasskeyFlag) {
      nav('/onboarding/auth/phone?mode=login', { replace: true });
      return;
    }

    setBusy(true);
    try {
      // 1) Local passkey verification
      const ok = await verifyLocalPasskey(phone, p);
      if (!ok) {
        toast.error('Incorrect passkey. Try again.');
        return;
      }

      // 2) Ask backend for a Firebase custom token
      let customToken: string | null = null;
      try {
        const base = import.meta.env.DEV ? 'http://localhost:3000' : '';
        const resp = await fetch(base + '/api/auth/mintCustomToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.ok && data?.token) {
            customToken = data.token as string;
          } else {
            console.warn('mintCustomToken bad payload', data);
          }
        } else {
          console.warn('mintCustomToken HTTP error', resp.status);
        }
      } catch (err) {
        console.warn('mintCustomToken fetch error', err);
      }

      // 3) Silently re-authenticate Firebase with that token
      if (customToken) {
        try {
          const auth = getAuth();
          await signInWithCustomToken(auth, customToken);
          console.log('✅ Firebase re-signed in via custom token');
        } catch (err) {
          console.warn('signInWithCustomToken failed', err);
        }
      } else {
        console.warn('No custom token received; continuing without Firebase sign-in');
      }

      // 4) Restore local session hints
      try {
        sessionStorage.setItem('bw.session.phone', phone);
        localStorage.setItem('bw.lastPhone', phone);
        sessionStorage.removeItem('bw.logoutReason');
        sessionStorage.removeItem('bw.requirePermRecheck');
      } catch {}

      // 5) Hydrate profile from backend NOW so UI shows correct name/coins/etc.
      try {
        await hydrateActiveFromCloud();
      } catch (err) {
        console.warn('hydrateActiveFromCloud after unlock failed', err);
      }

      // 6) Emit global auth event (balances, headers, push setup listeners, etc.)
      emit('bw:auth:changed', null);

      // 7) Redirect to last known route
      const back = computeBackRoute();
      nav(back, { replace: true });
    } catch (err) {
      console.error('Unlock flow failed', err);
      toast.error('Could not unlock. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const unlockCta = hasPasskeyFlag
    ? busy
      ? 'Unlocking…'
      : 'Unlock'
    : 'Continue to login';

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <form
        onSubmit={onUnlock}
        className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-6 space-y-4 shadow-lg animate-fade-up"
      >
        <h1 className="text-2xl font-bold">Quick unlock</h1>
        <p className="text-sm text-gray-600">
          {phone ? `Unlocking ${phone}` : 'Enter your passkey'}
        </p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="Passkey"
          className="w-full rounded-xl border px-4 py-3 outline-none focus:ring"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !p}
          className="w-full rounded-xl py-3 font-semibold bg-black text-white disabled:opacity-50"
        >
          {unlockCta}
        </button>
      </form>
    </div>
  );
}
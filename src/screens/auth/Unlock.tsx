// src/screens/auth/Unlock.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { getActiveProfile, getLastRoute } from '../../lib/profileStore';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
// Lazy-load heavy modules to keep the unlock bundle small
let lazyProfile: Promise<typeof import('../../lib/cloudProfile')> | null = null;
const loadProfile = () => {
  if (!lazyProfile) lazyProfile = import('../../lib/cloudProfile');
  return lazyProfile;
};
let lazyNotify: Promise<typeof import('../../lib/notify')> | null = null;
const loadNotify = () => {
  if (!lazyNotify) lazyNotify = import('../../lib/notify');
  return lazyNotify;
};
let lazyTrack: Promise<typeof import('../../lib/track')> | null = null;
const loadTrack = () => {
  if (!lazyTrack) lazyTrack = import('../../lib/track');
  return lazyTrack;
};
import { requestAuthenticationOptions, verifyAuthentication } from '../../lib/webauthnClient';

export default function Unlock() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [supported, setSupported] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        setSupported(false);
        return;
      }
      try {
        const available = await platformAuthenticatorIsAvailable();
        if (!cancelled) setSupported(available);
      } catch {
        if (!cancelled) setSupported(true);
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function runPasskey(e?: React.FormEvent) {
    e?.preventDefault();
    if (!phone) {
      toast.error('No account hint found. Please log in again.');
      nav('/onboarding', { replace: true });
      return;
    }
    if (supported === false) {
      toast.error('This browser does not support passkeys yet.');
      return;
    }

    setBusy(true);
    setStatus('Requesting secure challenge…');
    setErrorMsg(null);
    try {
      const options = await requestAuthenticationOptions(phone);
      if (!options || !options.challenge) {
        throw new Error('Passkey challenge unavailable. Please try again or use OTP.');
      }
      setStatus('Waiting for your device passkey…');
      const assertion = await startAuthentication(options);
      setStatus('Verifying passkey with BiteWise…');
      const verification = await verifyAuthentication(phone, assertion);
      const token = verification?.token;
      if (!token) {
        throw new Error('No session token returned. Please sign in again.');
      }

      try {
        const auth = getAuth();
        await signInWithCustomToken(auth, token);
        await loadNotify().then((m) => m.initOrRefreshPushOnAuth(phone)).catch(() => {});
        loadTrack().then((m) => m.track('unlock_success', { phone })).catch(() => {});
      } catch (err) {
        console.warn('signInWithCustomToken failed', err);
        loadTrack().then((m) => m.track('mint_token_failed', { status: 'passkey', reason: (err as Error)?.message })).catch(() => {});
        toast.error('Could not restore your session. Please sign in again.');
        nav('/onboarding/auth/phone?mode=login', { replace: true });
        return;
      }

      try {
        sessionStorage.setItem('bw.session.phone', phone);
        sessionStorage.setItem('bw.auth.verified', '1');
        localStorage.setItem('bw.lastPhone', phone);
        try {
          const prof = getActiveProfile();
          if (prof?.name) localStorage.setItem('bw:lastUserName', prof.name);
          if (prof?.phone) localStorage.setItem('bw:lastUserPhone', prof.phone);
          localStorage.setItem('bw:hasPasskey', 'true');
        } catch {}
        sessionStorage.removeItem('bw.logoutReason');
        sessionStorage.removeItem('bw.requirePermRecheck');
      } catch {}

      try {
        await loadProfile().then((m) => m.hydrateActiveFromCloud());
      } catch (err) {
        console.warn('hydrateActiveFromCloud after unlock failed', err);
      }

      emit('bw:auth:changed', null);
      const back = computeBackRoute();
      nav(back, { replace: true });
    } catch (err: any) {
      const code = String(err?.name || '').toLowerCase();
      const statusCode = typeof err?.status === 'number' ? err.status : null;
      if (code === 'notallowederror' || code === 'aborterror') {
        const msg = 'Passkey request was cancelled.';
        setErrorMsg(msg);
        toast.info(msg);
      } else if (statusCode === 404) {
        const msg = 'No passkey found for this account. Use OTP to sign in again.';
        setErrorMsg(msg);
        toast.error(msg);
        nav('/onboarding/auth/phone?mode=login', { replace: true });
      } else if (statusCode === 400) {
        const msg = err?.message || 'Passkey challenge expired. Try again.';
        setErrorMsg(msg);
        toast.error(msg);
      } else if (statusCode === 504) {
        const msg = 'Passkey timed out. Try again or use OTP.';
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        console.error('Unlock flow failed', err);
        const msg = 'Could not unlock. Please try again or use OTP.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setStatus('');
      setBusy(false);
    }
  }

  function goOtp() {
    const redirect = computeBackRoute();
    try {
      sessionStorage.setItem('bw.auth.redirect', redirect);
    } catch {}
    nav(`/onboarding/auth/phone?mode=login`, { replace: true });
  }

  const buttonLabel = busy ? 'Verifying…' : 'Unlock with passkey';

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <form
        onSubmit={runPasskey}
        className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-6 space-y-4 shadow-lg animate-fade-up"
      >
        <h1 className="text-2xl font-bold">Quick unlock</h1>
        <p className="text-sm text-gray-600">
          {phone ? `Unlocking ${phone}` : 'Use your saved passkey to continue.'}
        </p>
        {status ? (
          <div className="text-xs rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-gray-700">
            {status}
          </div>
        ) : null}
        {errorMsg ? (
          <div className="text-xs rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600">
            {errorMsg}
          </div>
        ) : null}
        {supported === false ? (
          <div className="text-xs rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600">
            Passkeys are unavailable in this browser. Try Chrome, Safari, or Edge on a secure device.
          </div>
        ) : null}
        <button
          type="submit"
          disabled={busy || supported === false}
          className="w-full rounded-2xl py-3 font-semibold bg-black text-white disabled:opacity-50"
        >
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={goOtp}
          className="w-full rounded-2xl py-3 font-semibold border border-black/20 text-black hover:bg-black/5"
          disabled={busy}
        >
          Use OTP instead
        </button>
      </form>
    </div>
  );
}

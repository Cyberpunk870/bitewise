// src/screens/auth/QuickUnlock.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import { requestAuthenticationOptions, verifyAuthentication } from '../../lib/webauthnClient';
import { getActiveProfile } from '../../lib/profileStore';

export default function QuickUnlock() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const { lastName, lastPhone, hasPasskey } = useMemo(() => {
    try {
      const lastUserName = localStorage.getItem('bw:lastUserName') || '';
      const lastUserPhone =
        localStorage.getItem('bw:lastUserPhone') ||
        localStorage.getItem('bw.lastPhone') ||
        '';

      const has = localStorage.getItem('bw:hasPasskey') === 'true';

      console.log('[QuickUnlock] useMemo init', {
        lastUserName,
        lastUserPhone,
        hasPasskeyStorage: localStorage.getItem('bw:hasPasskey'),
      });

      return {
        lastName: lastUserName,
        lastPhone: lastUserPhone,
        hasPasskey: has,
      };
    } catch (err) {
      console.warn('[QuickUnlock] useMemo init failed', err);
      return { lastName: '', lastPhone: '', hasPasskey: false };
    }
  }, []);

  useEffect(() => {
    console.log('[QuickUnlock] mount', {
      lastName,
      lastPhone,
      hasPasskey,
      rawHasPasskey: localStorage.getItem('bw:hasPasskey'),
    });
  }, [lastName, lastPhone, hasPasskey]);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      console.log('[QuickUnlock] detect() start');

      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        console.log('[QuickUnlock] WebAuthn not available in this environment');
        setSupported(false);
        return;
      }

      try {
        const available = await platformAuthenticatorIsAvailable();
        console.log('[QuickUnlock] platformAuthenticatorIsAvailable result', {
          available,
          cancelled,
        });
        if (!cancelled) setSupported(available);
      } catch (err) {
        console.warn('[QuickUnlock] platformAuthenticatorIsAvailable threw', err);
        if (!cancelled) setSupported(true);
      }
    }

    detect();

    return () => {
      cancelled = true;
      console.log('[QuickUnlock] detect() cleanup: cancelled=true');
    };
  }, []);

  async function runPasskey() {
    console.log('[QuickUnlock] runPasskey() called', {
      supported,
      hasPasskey,
      lastPhone,
      busy,
    });

    if (!hasPasskey || !lastPhone) {
      console.warn('[QuickUnlock] missing hasPasskey/lastPhone, redirecting to OTP', {
        hasPasskey,
        lastPhone,
      });
      nav('/onboarding/auth/phone?mode=login', { replace: true });
      return;
    }

    if (supported === false) {
      console.warn('[QuickUnlock] supported=false, showing device-unavailable message');
      toast.error('Passkeys are unavailable on this device.');
      return;
    }

    setBusy(true);
    setStatus('Requesting device passkey…');
    setErrorMsg(null);

    try {
      console.log('[QuickUnlock] requesting options from backend…', { lastPhone });
      const options = await requestAuthenticationOptions(lastPhone);
      console.log('[QuickUnlock] options received', options);

      if (!options || !options.challenge) {
        console.error('[QuickUnlock] options missing challenge', options);
        throw new Error('Passkey challenge unavailable. Use OTP.');
      }

      setStatus('Waiting for your device…');
      console.log('[QuickUnlock] calling startAuthentication…');
      const assertion = await startAuthentication({ optionsJSON: options });
      console.log('[QuickUnlock] assertion received', assertion);

      setStatus('Verifying…');
      console.log('[QuickUnlock] sending assertion to verifyAuthentication…');
      const verification = await verifyAuthentication(lastPhone, assertion);
      console.log('[QuickUnlock] verification response', verification);

      const token = (verification as any)?.token;
      console.log('[QuickUnlock] extracted token', {
        hasToken: !!token,
        tokenPreview: token ? String(token).slice(0, 12) + '…' : null,
      });

      if (!token) {
        throw new Error('No session token returned. Please sign in again.');
      }

      const auth = getAuth();
      console.log('[QuickUnlock] signing in with custom token via Firebase…');
      await signInWithCustomToken(auth, token);

      try {
        console.log('[QuickUnlock] storing session + local hints…');
        sessionStorage.setItem('bw.session.phone', lastPhone);
        sessionStorage.setItem('bw.auth.verified', '1');
        localStorage.setItem('bw.lastPhone', lastPhone);
      } catch (err) {
        console.warn('[QuickUnlock] failed to persist session/local hints', err);
      }

      emit('bw:auth:changed', null);

      // Remember last user info for next time (after profile load)
      try {
        const prof = getActiveProfile();
        console.log('[QuickUnlock] active profile after unlock', prof);

        // NOTE: using prof.name and prof.phone exactly as before
        if (prof?.name) localStorage.setItem('bw:lastUserName', prof.name as any);
        if (prof?.phone) localStorage.setItem('bw:lastUserPhone', prof.phone as any);
        localStorage.setItem('bw:hasPasskey', 'true');
      } catch (err) {
        console.warn('[QuickUnlock] getActiveProfile / remember-last-user failed', err);
      }

      console.log('[QuickUnlock] success → navigating to /home');
      nav('/home', { replace: true });
    } catch (err: any) {
      console.error('[QuickUnlock] FAILED', {
        err,
        name: err?.name,
        message: err?.message,
        code: err?.code,
        status: err?.status,
        response: err?.response,
        data: err?.data,
      });

      const code = String(err?.name || '').toLowerCase();
      const statusCode = typeof err?.status === 'number' ? err.status : null;

      const msg =
        code === 'notallowederror' || code === 'aborterror'
          ? 'Passkey prompt was cancelled.'
          : statusCode === 404
          ? 'No passkey found. Use OTP to sign in again.'
          : 'Could not unlock. Please try again or use OTP.';

      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setStatus('');
      console.log('[QuickUnlock] runPasskey() finished', {
        busy: false,
      });
    }
  }

  const useAnother = () => {
    console.log('[QuickUnlock] useAnother() → redirecting to OTP login');
    nav('/onboarding/auth/phone?mode=login', { replace: true });
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-8 text-white">
      <div className="glass-card w-full max-w-md p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-white/70">Unlock BiteWise on this device</p>
        </div>

        <div className="text-sm text-white/80 rounded-2xl border border-white/10 bg-white/5 p-3">
          {lastName ? <div className="font-semibold">{lastName}</div> : null}
          {lastPhone ? (
            <div className="text-white/70">{lastPhone}</div>
          ) : (
            <div className="text-white/60">No account hint saved</div>
          )}
        </div>

        {status ? (
          <div className="text-xs rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
            {status}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="text-xs rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-red-100">
            {errorMsg}
          </div>
        ) : null}

        {supported === false ? (
          <div className="text-xs rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-red-100">
            Passkeys are unavailable on this device. Use another sign-in method.
          </div>
        ) : null}

        <button
          type="button"
          onClick={runPasskey}
          disabled={busy || supported === false || !hasPasskey || !lastPhone}
          className="w-full rounded-2xl py-3 font-semibold bg-white text-black disabled:opacity-50"
        >
          {busy ? 'Unlocking…' : 'Unlock with BiteWise Passkey'}
        </button>

        <button
          type="button"
          onClick={useAnother}
          disabled={busy}
          className="w-full rounded-2xl py-3 font-semibold border border-white/20 text-white hover:bg-white/10"
        >
          Use a different account
        </button>
      </div>
    </div>
  );
}
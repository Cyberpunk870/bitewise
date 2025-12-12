// src/screens/auth/QuickUnlock.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import { requestAuthenticationOptions, verifyAuthentication } from '../../lib/webauthnClient';
import { getActiveProfile } from '../../lib/profileStore';

console.log('[QuickUnlock] FILE LOADED v1.2.0');

export default function QuickUnlock() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const { lastName, lastPhone, hasPasskey } = useMemo(() => {
    try {
      const lastName = localStorage.getItem('bw:lastUserName') || '';
      const lastPhone =
        localStorage.getItem('bw:lastUserPhone') ||
        localStorage.getItem('bw.lastPhone') ||
        '';
      const hasPasskey = localStorage.getItem('bw:hasPasskey') === 'true';

      console.log('[QuickUnlock] memo init', { lastName, lastPhone, hasPasskey });
      return { lastName, lastPhone, hasPasskey };
    } catch (e) {
      console.warn('[QuickUnlock] memo init failed', e);
      return { lastName: '', lastPhone: '', hasPasskey: false };
    }
  }, []);

  useEffect(() => {
    console.log('[QuickUnlock] mounted', { lastPhone, hasPasskey });
  }, [lastPhone, hasPasskey]);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      console.log('[QuickUnlock] detect() starting');
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        console.log('[QuickUnlock] WebAuthn unsupported');
        setSupported(false);
        return;
      }

      try {
        const available = await platformAuthenticatorIsAvailable();
        if (!cancelled) {
          console.log('[QuickUnlock] platformAuthenticatorIsAvailable =', available);
          setSupported(available);
        }
      } catch (e) {
        console.warn(
          '[QuickUnlock] platformAuthenticatorIsAvailable threw, defaulting to true',
          e
        );
        if (!cancelled) setSupported(true);
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runPasskey() {
    console.log('[QuickUnlock] runPasskey CLICK', {
      hasPasskey,
      lastPhone,
      supported,
      busy,
    });

    if (!hasPasskey || !lastPhone) {
      console.log('[QuickUnlock] no hasPasskey/lastPhone, redirecting to OTP login');
      nav('/onboarding/auth/phone?mode=login', { replace: true });
      return;
    }

    if (supported === false) {
      toast.error('Passkeys are unavailable on this device.');
      return;
    }

    setBusy(true);
    setStatus('Requesting device passkey…');
    setErrorMsg(null);

    try {
      console.log('[QuickUnlock] requesting options from backend…');
      const options = await requestAuthenticationOptions(lastPhone);
      console.log('[QuickUnlock] options result', options);

      if (!options || !options.challenge) {
        throw new Error('Passkey challenge unavailable. Use OTP.');
      }

      setStatus('Waiting for your device…');
      console.log('[QuickUnlock] calling startAuthentication');
      const assertion = await startAuthentication({ optionsJSON: options });
      console.log('[QuickUnlock] assertion received', {
        rawIdLength: assertion?.rawId?.length,
        type: assertion?.type,
      });

      setStatus('Verifying…');
      console.log('[QuickUnlock] verifying assertion with backend…');
      const verification = await verifyAuthentication(lastPhone, assertion);
      console.log('[QuickUnlock] verification result', verification);

      const token = (verification as any)?.token as string | undefined;
      console.log('[QuickUnlock] custom token length', token?.length);

      if (!token) {
        throw new Error('No session token returned. Please sign in again.');
      }

      const auth = getAuth();
      console.log('[QuickUnlock] calling signInWithCustomToken…');
      try {
        await signInWithCustomToken(auth, token);
        console.log('[QuickUnlock] signInWithCustomToken resolved', {
          currentUser: auth.currentUser
            ? {
                uid: auth.currentUser.uid,
                phoneNumber: auth.currentUser.phoneNumber,
              }
            : null,
        });
      } catch (firebaseErr: any) {
        console.error('[QuickUnlock] signInWithCustomToken FAILED', {
          name: firebaseErr?.name,
          code: firebaseErr?.code,
          message: firebaseErr?.message,
        });
        throw firebaseErr;
      }

      // Session + profile bookkeeping
      try {
        console.log('[QuickUnlock] setting session/localStorage flags');
        sessionStorage.setItem('bw.session.phone', lastPhone);
        sessionStorage.setItem('bw.auth.verified', '1');
        localStorage.setItem('bw.lastPhone', lastPhone);
      } catch (e) {
        console.warn('[QuickUnlock] failed to set session/localStorage', e);
      }

      emit('bw:auth:changed', null);

      // Remember last user info for next time
      try {
        const prof = getActiveProfile();
        console.log('[QuickUnlock] getActiveProfile()', prof);
        if (prof?.name) localStorage.setItem('bw:lastUserName', prof.name);
        if (prof?.phone) localStorage.setItem('bw:lastUserPhone', prof.phone);
        localStorage.setItem('bw:hasPasskey', 'true');
      } catch (e) {
        console.warn('[QuickUnlock] getActiveProfile failed', e);
      }

      console.log('[QuickUnlock] navigating to /home');
      nav('/home', { replace: true });
    } catch (err: any) {
      console.error('[QuickUnlock] FAILED', err);

      const code = String(err?.name || '').toLowerCase();
      const statusCode = typeof err?.status === 'number' ? err.status : null;

      const msg =
        code === 'notallowederror' || code === 'aborterror'
          ? 'Passkey prompt was cancelled.'
          : statusCode === 404
          ? 'No passkey found. Use OTP to sign in again.'
          : err?.code === 'auth/network-request-failed'
          ? 'Network error while signing in. Check your connection and try again.'
          : err?.code === 'auth/invalid-custom-token' ||
            err?.code === 'auth/custom-token-mismatch'
          ? 'Login token was rejected. Please sign in with OTP once on this device.'
          : 'Could not unlock. Please try again or use OTP.';

      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  const useAnother = () =>
    nav('/onboarding/auth/phone?mode=login', { replace: true });

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
          className="w-full rounded-2xl py-3 font-semibold border border-white/20 text-white hover:bg:white/10 hover:bg-white/10"
        >
          Use a different account
        </button>
      </div>
    </div>
  );
}
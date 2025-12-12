import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startAuthentication,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import {
  requestAuthenticationOptions,
  verifyAuthentication,
} from '../../lib/webauthnClient';
import { getActiveProfile } from '../../lib/profileStore';

const log = (...args: any[]) => console.log('[QuickUnlock]', ...args);
const logErr = (...args: any[]) => console.error('[QuickUnlock]', ...args);

log('FILE LOADED v1.0.4');

export default function QuickUnlock() {
  const nav = useNavigate();

  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const { lastName, lastPhone, hasPasskey } = useMemo(() => {
    try {
      const result = {
        lastName: localStorage.getItem('bw:lastUserName') || '',
        lastPhone:
          localStorage.getItem('bw:lastUserPhone') ||
          localStorage.getItem('bw.lastPhone') ||
          '',
        hasPasskey: localStorage.getItem('bw:hasPasskey') === 'true',
      };
      log('useMemo init', result);
      return result;
    } catch (err) {
      logErr('useMemo error reading localStorage', err);
      return { lastName: '', lastPhone: '', hasPasskey: false };
    }
  }, []);

  // 1) Log mount
  useEffect(() => {
    log('component mounted', { lastPhone, hasPasskey });
  }, [lastPhone, hasPasskey]);

  // 2) Detect platform authenticator availability
  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        log('[detect] WebAuthn not supported by browser');
        setSupported(false);
        return;
      }
      try {
        const available = await platformAuthenticatorIsAvailable();
        if (!cancelled) {
          log('[detect] platformAuthenticatorIsAvailable', { available });
          setSupported(available);
        }
      } catch (err) {
        if (!cancelled) {
          logErr('[detect] error, assuming supported', err);
          setSupported(true);
        }
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  // 3) Critical: watch Firebase auth state and navigate when user is logged in
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      log('[authStateChanged]', { authed: !!user, uid: user?.uid, phone: user?.phoneNumber });
      if (user) {
        // if anything went weird in runPasskey navigation, this guarantees exit
        nav('/home', { replace: true });
      }
    });

    return () => unsub();
  }, [nav]);

  async function runPasskey() {
    log('[runPasskey] CLICK', { hasPasskey, lastPhone, supported });

    if (!hasPasskey || !lastPhone) {
      log('[runPasskey] missing hasPasskey/lastPhone – redirecting to OTP login');
      nav('/onboarding/auth/phone?mode=login', { replace: true });
      return;
    }

    if (supported === false) {
      const msg = 'Passkeys are unavailable on this device.';
      setErrorMsg(msg);
      toast.error(msg);
      log('[runPasskey] supported === false, aborting');
      return;
    }

    setBusy(true);
    setStatus('Requesting device passkey…');
    setErrorMsg(null);

    let verification: any = null;

    try {
      log('[runPasskey] requesting options from backend…', { lastPhone });
      const options = await requestAuthenticationOptions(lastPhone);
      log('[runPasskey] options received', options);

      if (!options || !options.challenge) {
        throw new Error('Passkey challenge unavailable. Use OTP.');
      }

      setStatus('Waiting for your device…');

      log('[runPasskey] calling startAuthentication with optionsJSON');
      const assertion = await startAuthentication({ optionsJSON: options });
      log('[runPasskey] assertion received from browser', assertion);

      setStatus('Verifying…');

      log('[runPasskey] verifying assertion with backend…');
      verification = await verifyAuthentication(lastPhone, assertion);
      log('[runPasskey] verification result from backend', verification);

      const token = verification?.token;
      if (!token) {
        throw new Error('No session token returned. Please sign in again.');
      }

      const auth = getAuth();
      log('[runPasskey] signing in with Firebase custom token…');
      await signInWithCustomToken(auth, token);
      log('[runPasskey] firebase sign-in OK', {
        uid: auth.currentUser?.uid,
        phone: auth.currentUser?.phoneNumber,
      });

      // Persist session hints
      try {
        sessionStorage.setItem('bw.session.phone', lastPhone);
        sessionStorage.setItem('bw.auth.verified', '1');
        localStorage.setItem('bw.lastPhone', lastPhone);
      } catch (err) {
        logErr('[runPasskey] error saving session hints', err);
      }

      emit('bw:auth:changed', null);

      // Remember last user info for next time (after profile load)
      try {
        const prof = getActiveProfile();
        log('[runPasskey] getActiveProfile()', prof);
        if (prof?.name) localStorage.setItem('bw:lastUserName', prof.name);
        if (prof?.phone) localStorage.setItem('bw:lastUserPhone', prof.phone);
        localStorage.setItem('bw:hasPasskey', 'true');
      } catch (err) {
        logErr('[runPasskey] error saving profile hints', err);
      }

      // We still navigate here; the authStateChanged effect is extra safety
      log('[runPasskey] navigation to /home');
      nav('/home', { replace: true });
    } catch (err: any) {
      const errName = String(err?.name || '').toLowerCase();
      const statusCode =
        typeof err?.status === 'number'
          ? err.status
          : typeof verification?.status === 'number'
          ? verification.status
          : null;
      const backendError = verification?.error || err?.response?.data?.error;

      const msg =
        errName === 'notallowederror' || errName === 'aborterror'
          ? 'Passkey prompt was cancelled.'
          : statusCode === 404 || backendError === 'no-passkey'
          ? 'No passkey found for this account. Use OTP to sign in again.'
          : 'Could not unlock. Please try again or use OTP.';

      logErr('[runPasskey] ERROR', {
        err,
        errName,
        statusCode,
        backendError,
        verification,
      });

      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      const auth = getAuth();
      const authed = !!auth.currentUser;
      log('[runPasskey] FINALLY', {
        authed,
        currentUser: auth.currentUser
          ? {
              uid: auth.currentUser.uid,
              phone: auth.currentUser.phoneNumber,
            }
          : null,
      });

      setBusy(false);
      setStatus('');

      // Extra safeguard: if somehow user is already authed, leave this screen.
      if (authed) {
        log('[runPasskey] FINALLY forcing navigation to /home because user is authed');
        nav('/home', { replace: true });
      }
    }
  }

  const useAnother = () => {
    log('[useAnother] clicked – going to OTP login');
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
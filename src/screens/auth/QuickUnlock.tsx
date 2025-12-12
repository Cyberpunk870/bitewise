// src/screens/auth/QuickUnlock.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startAuthentication,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import {
  requestAuthenticationOptions,
  verifyAuthentication,
} from '../../lib/webauthnClient';
import { getActiveProfile } from '../../lib/profileStore';

// File-level log so we know the bundle actually loaded
console.log('[QuickUnlock] FILE LOADED – version 1.0.2');

export default function QuickUnlock() {
  // Component render log
  console.log('[QuickUnlock] COMPONENT RENDER START');

  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const { lastName, lastPhone, hasPasskey } = useMemo(() => {
    try {
      return {
        lastName: localStorage.getItem('bw:lastUserName') || '',
        lastPhone:
          localStorage.getItem('bw:lastUserPhone') ||
          localStorage.getItem('bw.lastPhone') ||
          '',
        hasPasskey: localStorage.getItem('bw:hasPasskey') === 'true',
      };
    } catch {
      return { lastName: '', lastPhone: '', hasPasskey: false };
    }
  }, []);

  useEffect(() => {
    console.log('[QuickUnlock] mount', {
      lastPhone,
      hasPasskey,
    });
  }, [lastPhone, hasPasskey]);

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
      } catch (err) {
        console.warn(
          '[QuickUnlock] platformAuthenticatorIsAvailable failed, assuming supported',
          err,
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
    // Click log so we know the handler actually runs
    console.log('[QuickUnlock] runPasskey CLICK', {
      supported,
      hasPasskey,
      lastPhone,
      busy,
    });

    if (!hasPasskey || !lastPhone) {
      console.log('[QuickUnlock] No saved passkey or phone, redirecting to OTP login');
      nav('/onboarding/auth/phone?mode=login', { replace: true });
      return;
    }

    if (supported === false) {
      console.log('[QuickUnlock] Passkeys marked unsupported on this device');
      toast.error('Passkeys are unavailable on this device.');
      return;
    }

    setBusy(true);
    setStatus('Requesting device passkey…');
    setErrorMsg(null);

    try {
      console.log('[QuickUnlock] Fetching authentication options…');
      const options = await requestAuthenticationOptions(lastPhone);
      console.log('[QuickUnlock] Authentication options received:', options);

      if (!options || !options.challenge) {
        throw new Error('Passkey challenge unavailable. Use OTP.');
      }

      setStatus('Waiting for your device…');
      console.log('[QuickUnlock] Calling startAuthentication…');
      const assertion = await startAuthentication({ optionsJSON: options });
      console.log('[QuickUnlock] Assertion from device:', assertion);

      setStatus('Verifying…');
      console.log('[QuickUnlock] Verifying assertion with backend…');
      const verification = await verifyAuthentication(lastPhone, assertion);
      console.log('[QuickUnlock] Verification result:', verification);

      const token = verification?.token;
      if (!token) {
        throw new Error('No session token returned. Please sign in again.');
      }

      console.log('[QuickUnlock] Signing in with custom token…');
      const auth = getAuth();
      await signInWithCustomToken(auth, token);

      try {
        console.log('[QuickUnlock] Saving session + local hints…');
        sessionStorage.setItem('bw.session.phone', lastPhone);
        sessionStorage.setItem('bw.auth.verified', '1');
        localStorage.setItem('bw.lastPhone', lastPhone);
      } catch (storageErr) {
        console.warn('[QuickUnlock] Failed to write session/localStorage hints', storageErr);
      }

      emit('bw:auth:changed', null);

      // Remember last user info for next time (after profile load)
      try {
        const prof = getActiveProfile();
        console.log('[QuickUnlock] Active profile at unlock:', prof);
        if (prof?.name) localStorage.setItem('bw:lastUserName', prof.name);
        if (prof?.phone) localStorage.setItem('bw:lastUserPhone', prof.phone);
        localStorage.setItem('bw:hasPasskey', 'true');
      } catch (profErr) {
        console.warn('[QuickUnlock] Failed to cache profile hints', profErr);
      }

      console.log('[QuickUnlock] Navigation to /home');
      nav('/home', { replace: true });
    } catch (err: any) {
      // SUPER noisy logging so we can see exactly what happens
      console.error('[QuickUnlock] runPasskey ERROR', err);

      const code = String(err?.name || '').toLowerCase();
      const statusCode = typeof err?.status === 'number' ? err.status : null;

      console.log('[QuickUnlock] Error details:', {
        name: err?.name,
        message: err?.message,
        code,
        statusCode,
        full: err,
      });

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
      console.log('[QuickUnlock] runPasskey FINISHED');
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
          className="w-full rounded-2xl py-3 font-semibold border border-white/20 text-white hover:bg-white/10"
        >
          Use a different account
        </button>
      </div>
    </div>
  );
}
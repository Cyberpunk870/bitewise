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
      return {
        lastName: localStorage.getItem('bw:lastUserName') || '',
        lastPhone: localStorage.getItem('bw:lastUserPhone') || localStorage.getItem('bw.lastPhone') || '',
        hasPasskey: localStorage.getItem('bw:hasPasskey') === 'true',
      };
    } catch {
      return { lastName: '', lastPhone: '', hasPasskey: false };
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
    return () => { cancelled = true; };
  }, []);

  async function runPasskey() {
    if (!hasPasskey || !lastPhone) {
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
      const options = await requestAuthenticationOptions(lastPhone);
      if (!options || !options.challenge) throw new Error('Passkey challenge unavailable. Use OTP.');
      setStatus('Waiting for your device…');
      const assertion = await startAuthentication(options);
      setStatus('Verifying…');
      const verification = await verifyAuthentication(lastPhone, assertion);
      const token = verification?.token;
      if (!token) throw new Error('No session token returned. Please sign in again.');

      const auth = getAuth();
      await signInWithCustomToken(auth, token);
      try {
        sessionStorage.setItem('bw.session.phone', lastPhone);
        sessionStorage.setItem('bw.auth.verified', '1');
        localStorage.setItem('bw.lastPhone', lastPhone);
      } catch {}
      emit('bw:auth:changed', null);

      // Remember last user info for next time (after profile load)
      try {
        const prof = getActiveProfile();
        if (prof?.name) localStorage.setItem('bw:lastUserName', prof.name);
        if (prof?.phone) localStorage.setItem('bw:lastUserPhone', prof.phone);
        localStorage.setItem('bw:hasPasskey', 'true');
      } catch {}

      nav('/home', { replace: true });
    } catch (err: any) {
      console.error('QuickUnlock failed', err);
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
    }
  }

  const useAnother = () => nav('/onboarding/auth/phone?mode=login', { replace: true });

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-8 text-white">
      <div className="glass-card w-full max-w-md p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-white/70">Unlock BiteWise on this device</p>
        </div>
        <div className="text-sm text-white/80 rounded-2xl border border-white/10 bg-white/5 p-3">
          {lastName ? <div className="font-semibold">{lastName}</div> : null}
          {lastPhone ? <div className="text-white/70">{lastPhone}</div> : <div className="text-white/60">No account hint saved</div>}
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
          {busy ? 'Unlocking…' : 'Unlock with device'}
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

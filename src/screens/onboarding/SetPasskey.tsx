// src/screens/onboarding/SetPasskey.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { startRegistration, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { getLastRoute } from '../../lib/profileStore';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import {
  fetchPasskeys,
  requestRegistrationOptions,
  verifyRegistration,
  type PasskeySummary,
} from '../../lib/webauthnClient';

function formatTimestamp(ts?: string) {
  if (!ts) return 'Never used yet';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function SetPasskey() {
  const nav = useNavigate();
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = passkeys.length > 0;
  const primaryLabel = passkeys[0]?.label || passkeys[0]?.deviceType || 'Passkey';

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

  useEffect(() => {
    refreshPasskeys();
  }, []);

  async function refreshPasskeys() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPasskeys();
      setPasskeys(list);
    } catch (err) {
      console.warn('fetchPasskeys failed', err);
      setError('Could not load your registered devices.');
    } finally {
      setLoading(false);
    }
  }

  function computeSafeBack(): string {
    const backRaw =
      getLastRoute() ||
      sessionStorage.getItem('bw.lastRoute') ||
      '';
    const bad = !backRaw ||
      backRaw.startsWith('/onboarding') ||
      backRaw.startsWith('/auth') ||
      backRaw === '/unlock' ||
      backRaw === '/onboarding' ||
      backRaw === '/';
    return bad ? '/home' : backRaw;
  }

  async function handleRegister() {
    if (supported === false) {
      toast.error('Passkeys are not supported in this browser yet. Try a modern browser.');
      return;
    }
    setBusy(true);
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const label = ua ? ua.split(') ')[0]?.slice(0, 60) ?? 'Device passkey' : undefined;
      const options = await requestRegistrationOptions(label);
      const credential = await startRegistration(options);
      await verifyRegistration(credential, { label, userAgent: ua });
      emit('bw:passkey:set', null);
      toast.success(existing ? 'Passkey updated' : 'Passkey set');
      try {
        const prof = getActiveProfile();
        if (prof?.name) localStorage.setItem('bw:lastUserName', prof.name);
        if (prof?.phone) localStorage.setItem('bw:lastUserPhone', prof.phone);
        localStorage.setItem('bw:hasPasskey', 'true');
      } catch {}
      await refreshPasskeys();
      const back = computeSafeBack();
      nav(back, { replace: true });
    } catch (err: any) {
      const code = String(err?.name || '').toLowerCase();
      if (code === 'notallowederror' || code === 'aborterror') {
        toast.info('Passkey setup was cancelled.');
      } else {
        console.error('passkey registration failed', err);
        toast.error(err?.message || 'Could not register passkey.');
      }
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || supported === false;

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-8 text-white">
      <div className="glass-card w-full max-w-md p-6 animate-fade-up space-y-5">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold">Enable Quick Unlock</h1>
          <p className="text-sm text-white/70">
            Use your device passkey (Face ID / Touch ID / PIN) to unlock BiteWise faster after idle.
          </p>
          <div className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-amber-200">
            Your biometric data never leaves the device. BiteWise stores only a public key tied to
            this browser profile. Clearing passkeys or switching devices means you’ll need to set a
            new one.
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-white/70">Checking existing passkeys…</div>
          ) : existing ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3 text-sm text-white/80 space-y-1">
              <div className="font-semibold">{primaryLabel}</div>
              <div className="text-xs text-white/60">
                Last used {formatTimestamp(passkeys[0]?.lastUsedAt || passkeys[0]?.createdAt)}
              </div>
              <div className="text-xs text-white/60">
                Additional devices: {Math.max(passkeys.length - 1, 0)}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 p-3 text-sm text-white/60">
              No passkey registered yet. You can skip for now and add one later from Settings.
            </div>
          )}
          {error ? <div className="text-xs text-red-200">{error}</div> : null}
          {supported === false ? (
            <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-xs text-red-100">
              This browser does not support passkeys. Use Chrome, Safari, or Edge on a device with
              biometrics enabled.
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <Link
            to={computeSafeBack()}
            className="px-3 py-2 rounded-xl border border-white/20 text-sm text-white/80 hover:text-white flex-1 text-center"
          >
            Skip for now
          </Link>
          <button
            onClick={handleRegister}
            disabled={disabled}
            className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-50 text-sm font-semibold flex-1"
          >
            {busy ? 'Connecting…' : existing ? 'Update Passkey' : 'Create Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}

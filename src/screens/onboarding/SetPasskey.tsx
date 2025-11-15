// src/screens/onboarding/SetPasskey.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setLocalPasskey, hasLocalPasskey } from '../../lib/passkeyLocal';
import { getLastRoute } from '../../lib/profileStore';
import { loadSession } from '../../lib/session';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';

export default function SetPasskey() {
  const nav = useNavigate();

  const phone = useMemo(() => {
    try {
      const fromSession = sessionStorage.getItem('bw.session.phone') || loadSession()?.phone || '';
      return fromSession || (localStorage.getItem('bw.lastPhone') || '');
    } catch {
      return '';
    }
  }, []);

  const [existing, setExisting] = useState<boolean>(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setExisting(!!(phone && hasLocalPasskey(phone))); }, [phone]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const minLen = 4;
  const valid = p1.length >= minLen && p1 === p2;

  function computesafeBack(): string {
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

  const onSave = async () => {
    if (!phone) {
      toast.error('No active phone found. Please log in again.');
      nav('/onboarding/auth/phone', { replace: true});
      return;
    }
    if (!valid) {
      toast.error('Passkeys must match and be at least 4 characters.');
      return;
    }
    setBusy(true);
    try {
      await setLocalPasskey(phone, p1);
      emit('bw:passkey:set', null);
      toast.success(existing ? 'Passkey updated' : 'Passkey set');
      const back = computesafeBack();
      nav(back, { replace: true });
    } catch {
      toast.error('Could not save passkey');
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy;

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-8 text-white">
      <div className="glass-card w-full max-w-md p-6 animate-fade-up space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold">Set Quick Unlock Passkey</h1>
          <p className="text-sm text-white/70">
            {existing
              ? 'Update your device-local passkey to quickly unlock after idle.'
              : 'Create a device-local passkey to quickly unlock after idle.'}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80">New passkey</label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white text-black px-3 py-2 outline-none"
              placeholder="Enter passkey (min 4 chars)"
              value={p1}
              onChange={(e) => setP1(e.target.value.slice(0, 32))}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80">Confirm passkey</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white text-black px-3 py-2 outline-none"
              placeholder="Re-enter passkey"
              value={p2}
              onChange={(e) => setP2(e.target.value.slice(0, 32))}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-white/70">
            This passkey is stored only on this device. It is not your account password and does not sync to the cloud.
          </p>
          {!valid && (p1.length > 0 || p2.length > 0) ? (
            <div className="text-xs text-red-300">
              Passkeys must match and be at least {minLen} characters.
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link
            to={computesafeBack()}
            className="px-3 py-2 rounded-xl border border-white/20 text-sm text-white/80 hover:text-white"
          >
            Skip for now
          </Link>
          <button
            onClick={onSave}
            disabled={busy || !valid}
            className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-50 text-sm font-semibold"
          >
            {busy ? 'Saving…' : existing ? 'Update Passkey' : 'Save Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-dvh grid place-items-center bg-gradient-to-br from-pink-500 to-orange-400 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white/80 backdrop-blur p-6 shadow animate-fade-up">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold">Set Quick Unlock Passkey</h1>
          <p className="text-sm opacity-80 mt-1">
            {existing
              ? 'Update your device-local passkey to quickly unlock after idle.'
              : 'Create a device-local passkey to quickly unlock after idle.'}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium">New passkey</label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/20 bg-white/80 dark:bg-white/10 px-3 py-2 outline-none"
              placeholder="Enter passkey (min 4 chars)"
              value={p1}
              onChange={(e) => setP1(e.target.value.slice(0, 32))}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Confirm passkey</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/20 bg-white/80 dark:bg-white/10 px-3 py-2 outline-none "
              placeholder="Re-enter passkey"
              value={p2}
              onChange={(e) => setP2(e.target.value.slice(0, 32))}
              disabled={disabled}
            />
          </div>
          <p className="text-xs opacity-70">
            This passkey is stored only on this device. It is not your account password and does not sync to the cloud.
          </p>
          {!valid && (p1.length > 0 || p2.length > 0) ? (
            <div className="text-xs text-red-700/90">
              Passkeys must match and be at least {minLen} characters.
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link to={computesafeBack()} className="px-3 py-2 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20 text-sm">
            Skip for now
          </Link>
          <button
            onClick={onSave}
            disabled={busy || !valid}
            className="px-4 py-2 rounded-xl bg-black/80 text-white hover:bg-black disabled:opacity-50 text-sm"
          >
            {busy ? 'Saving…' : existing ? 'Update Passkey' : 'Save Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}
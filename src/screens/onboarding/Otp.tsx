// src/screens/onboarding/Otp.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPhoneCode } from '../../lib/firebase';
import { useAuth } from '../../store/auth';
import { upsertUser, setActivePhone } from '../../lib/profileStore';
import { emit } from '../../lib/events';
// Dynamically loaded to keep OTP bundle lean
let lazyProfile: Promise<typeof import('../../lib/cloudProfile')> | null = null;
const loadProfile = () => {
  if (!lazyProfile) {
    lazyProfile = import('../../lib/cloudProfile');
  }
  return lazyProfile;
};
let lazyTrack: Promise<typeof import('../../lib/track')> | null = null;
const loadTrack = () => {
  if (!lazyTrack) {
    lazyTrack = import('../../lib/track');
  }
  return lazyTrack;
};

export default function Otp() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get('mode') || 'signup').toLowerCase() as 'signup' | 'login';

  const { phone } = useAuth();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Guard: prevent direct access if phone missing
    if (!phone) nav('/onboarding/auth/phone', { replace: true });
  }, [phone, nav]);

  // 🔔 helper to trigger existing toast system
  function toast(title: string, body: string) {
    try {
      window.dispatchEvent(new CustomEvent('bw:toast', { detail: { title, body } }));
    } catch {}
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    try {
      if (!/^\d{4,8}$/.test(code)) {
        setErr('Please enter the 6-digit code.');
        return;
      }
      setSubmitting(true);

      // ✅ verify with Firebase
      const user = await confirmPhoneCode(code);
      const phoneE164 = user.phoneNumber || phone;

      // ✅ create/update local profile + mark active
      if (phoneE164) {
        upsertUser({ phone: phoneE164, name: '' });
        setActivePhone(phoneE164);
        try {
          sessionStorage.setItem('bw.auth.verified', '1');
          sessionStorage.setItem('bw.session.phoneVerified', phoneE164);
          localStorage.setItem(
            'bw.session',
            JSON.stringify({ phone: phoneE164, createdAt: Date.now() })
          );
        } catch {}
      }

      // 🔄 notify the rest of app (AppShell, etc.)
      emit('bw:otp:verified', { phone: phoneE164 });
      emit('bw:auth:changed', null);
      loadTrack()
        .then((m) => m.track('login_success', { mode, phone: phoneE164 }))
        .catch(() => {});

      // Fire-and-forget profile sync to speed up OTP flow
      Promise.resolve()
        .then(() => loadProfile())
        .then((mod) => mod.hydrateActiveFromCloud())
        .then(() => loadProfile().then((mod) => mod.pushActiveToCloud()))
        .catch(() => {});

      // ✅ route next based on mode
      if (mode === 'signup') {
        toast('Phone verified', 'Let’s set up your profile.');
        nav('/onboarding/name', { replace: true });
      } else {
        toast('Welcome back', 'You are now signed in.');
        nav('/home', { replace: true });
      }
    } catch (error: any) {
      console.error(error);
      loadTrack()
        .then((m) =>
          m.track('otp_failed', { mode, reason: error?.code || error?.message || 'unknown' })
        )
        .catch(() => {});
      setErr(error?.message || 'Invalid code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 text-white" role="main">
      <form
        onSubmit={onSubmit}
        className="glass-card w-full max-w-md p-6 space-y-4 animate-fade-up"
      >
        <h1 className="text-2xl font-bold">Enter the code</h1>
        <p className="text-sm text-white/70">
          We sent an SMS to {phone || 'your number'}.
        </p>

        <input
          type="tel"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="6-digit code"
          className="w-full rounded-xl border border-white/15 px-4 py-3 tracking-widest text-center text-lg outline-none bg-white text-black focus:ring"
        />

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-50"
        >
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  );
}

// src/screens/onboarding/Phone.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ensureRecaptcha, sendOtp, clearRecaptcha } from '../../lib/firebase';
import { useAuth } from '../../store/auth';

const API_BASE_RAW = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');
const API_BASE = API_BASE_RAW.endsWith('/') ? API_BASE_RAW.slice(0, -1) : API_BASE_RAW;
const PUBLIC_BASE = `${API_BASE}/public`;

async function verifyPhone(phone: string, mode: 'signup' | 'login') {
  const url = `${PUBLIC_BASE}/check-phone?phone=${encodeURIComponent(phone)}&mode=${mode}`;
  const res = await fetch(url, { credentials: 'omit' });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || 'Unable to verify phone. Please try again.');
    (err as any).code = data?.code;
    (err as any).exists = data?.exists;
    throw err;
  }
  return Boolean(data?.exists);
}

export default function Phone() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get('mode') || 'signup') as 'signup' | 'login';
  const { phone, setPhone, setConfirmation } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showExists, setShowExists] = useState(false);

  const e164 = useMemo(() => {
    const raw = (phone || '').replace(/[^\d+]/g, '');
    if (raw.startsWith('+')) return raw;
    if (/^\d{10}$/.test(raw)) return `+91${raw}`;
    return raw;
  }, [phone]);

  // 🔧 reCAPTCHA: cleanup once when this screen unmounts
  useEffect(() => {
    return () => {
      try { clearRecaptcha(); } catch {}
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!/^\+\d{10,15}$/.test(e164)) {
      setErr('Please enter a valid phone number in E.164 format.');
      return;
    }

    setSubmitting(true);
    try {
      await verifyPhone(e164, mode);
      // Always proceed to OTP; existence is determined & upserted after verification on backend
      ensureRecaptcha();                 // create/reuse invisible widget (idempotent)
      const result = await sendOtp(e164); // uses the same singleton verifier
      setConfirmation(result);
      nav(`/onboarding/auth/otp?mode=${mode}`, { replace: true });
    } catch (error: any) {
      console.error(error);
      if (mode === 'signup' && error?.code === 'PHONE_EXISTS') {
        setErr('An account with this number already exists.');
        setShowExists(true);
      } else if (mode === 'login' && error?.code === 'PHONE_NOT_FOUND') {
        setErr('No account found with this number. Try signing up first.');
      } else {
        setErr(error?.message || 'Failed to send code. Please try again.');
      }
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 text-white">
      <form
        onSubmit={onSubmit}
        className="glass-card w-full max-w-md p-6 space-y-4 animate-fade-up"
      >
        <h1 className="text-2xl font-bold">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-white/70">
          Enter your phone to receive a one-time code.
        </p>

        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98765 43210"
          className="w-full rounded-xl border border-white/15 px-4 py-3 outline-none focus:ring bg-white text-black"
        />

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl py-3 font-semibold bg-white text-black disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send code'}
        </button>

        {/* Host for invisible reCAPTCHA (will be created if missing) */}
        <div id="recaptcha-container" />
      </form>

      {showExists && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 text-white">
            <h2 className="text-xl font-semibold">Number already on BiteWise</h2>
            <p className="text-sm text-white/70">
              Looks like this phone is already linked to an account. You can continue logging in
              with it or switch to a different number.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="flex-1 rounded-xl border border-white/30 py-2 text-white/80"
                onClick={() => {
                  setShowExists(false);
                  setPhone('');
                }}
              >
                Try different number
              </button>
              <button
                className="flex-1 rounded-xl bg-white text-black py-2 font-semibold"
                onClick={() => {
                  setShowExists(false);
                  nav('/onboarding/auth/phone?mode=login', { replace: true });
                }}
              >
                Login with this number
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

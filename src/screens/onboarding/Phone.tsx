// src/screens/onboarding/Phone.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ensureRecaptcha, sendOtp, clearRecaptcha } from '../../lib/firebase';
import { useAuth } from '../../store/auth';

export default function Phone() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get('mode') || 'signup') as 'signup' | 'login';
  const { phone, setPhone, setConfirmation } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      // Always proceed to OTP; existence is determined & upserted after verification on backend
      ensureRecaptcha();                 // create/reuse invisible widget (idempotent)
      const result = await sendOtp(e164); // uses the same singleton verifier
      setConfirmation(result);
      nav(`/onboarding/auth/otp?mode=${mode}`, { replace: true });
    } catch (error: any) {
      console.error(error);
      setErr(error?.message || 'Failed to send code. Please try again.');
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
    </div>
  );
}

// src/screens/onboarding/Welcome.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import useOnboarding from '../../store/onboarding';
import { hasLocalPasskey } from '../../lib/passkeyLocal';

const PASSKEY_ROUTE = '/auth/passkey';
const PHONE_ROUTE = '/onboarding/auth/phone?mode=login';

export default function Welcome() {
  const nav = useNavigate();
  const reset = useOnboarding(s => s.reset);

  const gotoSignup = () => {
    try { reset(); } catch {}
    nav('/onboarding/name', { replace: true });
  };

  const gotoLogin = () => {
    try { reset(); } catch {}

    const reason    = sessionStorage.getItem('bw.logoutReason') || '';
    const lastPhone = localStorage.getItem('bw.lastPhone') || '';
    const hasPx     = !!(lastPhone && hasLocalPasskey(lastPhone));

    // Prefer passkey only for IDLE logout + known local passkey
    if (reason === 'idle' && hasPx) {
      nav(PASSKEY_ROUTE, { replace: true });
      return;
    }

    // Otherwise go through phone + OTP
    nav(PHONE_ROUTE, { replace: true });
  };

  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="w-full max-w-md mx-auto px-6 text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold">BiteWise</h1>
          <p className="text-gray-700">Eat! Save! Repeat!</p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={gotoSignup} className="rounded-2xl border px-5 py-3">
            Sign up
          </button>
          <button type="button" onClick={gotoLogin} className="rounded-2xl border px-5 py-3">
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}

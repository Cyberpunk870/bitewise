// src/screens/onboarding/Welcome.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BitewiseLogo from '../../components/BitewiseLogo';

export default function Welcome() {
  const nav = useNavigate();
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const prefersReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) {
      setShowIntro(false);
      return;
    }
    const id = window.setTimeout(() => setShowIntro(false), 1200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {showIntro && (
        <div className="logo-splash absolute inset-0 z-20 grid place-items-center bg-[rgba(5,9,21,0.97)]">
          <BitewiseLogo size={96} showTagline />
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl bg-gradient-to-br from-[#f472b6]/30 via-transparent to-[#38bdf8]/30" />

      <div className="relative z-10 min-h-dvh grid place-items-center px-4 py-8">
        <div
          className={[
            'glass-card w-full max-w-sm p-6 text-white space-y-6 transition-all duration-700',
            showIntro ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0',
          ].join(' ')}
        >
          <div className="text-center">
            <BitewiseLogo size={54} showTagline />
          </div>

          <div className="space-y-3">
            <button
              onClick={() => nav('/onboarding/auth/phone?mode=signup')}
              className="w-full rounded-xl bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc] text-[#0b1120] py-3 font-semibold shadow-lg shadow-rose-500/25"
            >
              Sign up
            </button>
            <button
              onClick={() => nav('/onboarding/auth/phone?mode=login')}
              className="w-full rounded-xl border border-white/30 py-3 text-white/90 bg-white/5 hover:bg-white/10 transition"
            >
              Log in
            </button>
          </div>

          <p className="text-xs text-center text-white/70">
            Continue to verify your phone with an OTP.
          </p>
        </div>
      </div>
    </div>
  );
}

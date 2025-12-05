// src/screens/onboarding/Welcome.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BitewiseLogo from '../../components/BitewiseLogo';
import { track } from '../../lib/track';

export default function Welcome() {
  const nav = useNavigate();
  const [showOverlay, setShowOverlay] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    track('onboarding_start');
    const prefersReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) {
      setShowOverlay(false);
      return;
    }
    const tagTimer = window.setTimeout(() => setShowTagline(true), 320);
    const fadeTimer = window.setTimeout(() => setFadeOut(true), 1200);
    const hideTimer = window.setTimeout(() => setShowOverlay(false), 1700);
    return () => {
      window.clearTimeout(tagTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {showOverlay && (
        <div
          className={[
            'absolute inset-0 z-20 grid place-items-center bg-[rgba(5,9,21,0.97)] transition-opacity duration-600',
            fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100',
          ].join(' ')}
        >
          <div className="text-center select-none">
            <div
              className={[
                'text-5xl sm:text-6xl font-extrabold text-white tracking-tight transition-all duration-700',
                fadeOut ? 'scale-95 opacity-70' : 'scale-100 opacity-100',
              ].join(' ')}
            >
              Bite<span className="bg-gradient-to-r from-[#fbbf24] via-[#fb7185] to-[#a78bfa] bg-clip-text text-transparent">Wise</span>
            </div>
            <div
              className={[
                'mt-3 text-sm sm:text-base uppercase tracking-[0.35em] text-white/70 transition-opacity duration-600',
                showTagline ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            >
              Eat Save Repeat
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl bg-gradient-to-br from-[#f472b6]/30 via-transparent to-[#38bdf8]/30" />

      <div className="relative z-10 min-h-dvh grid place-items-center px-4 py-8">
        <div
          className={[
            'glass-card w-full max-w-sm p-6 text-white space-y-6 transition-all duration-700',
            showOverlay ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0',
          ].join(' ')}
        >
          <div className="text-center">
            <BitewiseLogo size={54} showTagline showMark={false} />
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

// src/screens/onboarding/Welcome.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const nav = useNavigate();

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-8">
      <div className="glass-card w-full max-w-sm p-6 animate-fade-up text-white space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold">BiteWise</h1>
          <p className="text-sm text-white/80">Eat! Save! Repeat!</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => nav('/onboarding/auth/phone?mode=signup')}
            className="w-full rounded-xl bg-white text-black py-3 font-semibold"
          >
            Sign up
          </button>
          <button
            onClick={() => nav('/onboarding/auth/phone?mode=login')}
            className="w-full rounded-xl border border-white/30 py-3 text-white/90"
          >
            Log in
          </button>
        </div>

        <p className="text-xs text-center text-white/70">
          Continue to verify your phone with an OTP.
        </p>
      </div>
    </div>
  );
}

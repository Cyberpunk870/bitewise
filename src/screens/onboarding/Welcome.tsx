// src/screens/onboarding/Welcome.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const nav = useNavigate();

  return (
    <div className="min-h-dvh grid place-items-center bg-gradient-to-br from-pink-500 to-orange-400 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white/85 dark:bg-white/10 backdrop-blur p-6 shadow animate-fade-up">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold">BiteWise</h1>
          <p className="text-sm opacity-80">Eat! Save! Repeat!</p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => nav('/onboarding/auth/phone?mode=signup')}
            className="w-full rounded-xl bg-black text-white py-3"
          >
            Sign up
          </button>
          <button
            onClick={() => nav('/onboarding/auth/phone?mode=login')}
            className="w-full rounded-xl border py-3"
          >
            Log in
          </button>
        </div>

        <p className="mt-4 text-xs text-center opacity-70">
          Continue to verify your phone with an OTP.
        </p>
      </div>
    </div>
  );
}

// src/screens/auth/Unlock.tsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveProfile, getLastRoute } from '../../lib/profileStore';
import { toast } from '../../store/toast';
import { emit } from '../../lib/events';
import { hydrateActiveFromCloud } from '../../lib/cloudProfile';

export default function Unlock() {
  const nav = useNavigate();

  const phone = useMemo(() => {
    try {
      const fromSession = sessionStorage.getItem('bw.session.phone') || '';
      if (fromSession) return fromSession;
      const last = localStorage.getItem('bw.lastPhone') || '';
      if (last) return last;
      const active = getActiveProfile();
      return active?.phone || '';
    } catch {
      return '';
    }
  }, []);

  function computeBackRoute(): string {
    try {
      const backRaw =
        getLastRoute() ||
        sessionStorage.getItem('bw.lastRoute') ||
        '';
      if (
        backRaw &&
        !backRaw.startsWith('/onboarding') &&
        !backRaw.startsWith('/auth') &&
        backRaw !== '/unlock'
      ) {
        return backRaw;
      }
    } catch {}
    return '/home';
  }

  function continueSession(e?: React.FormEvent) {
    e?.preventDefault();
    if (!phone) {
      toast.error('Session expired. Please log in again.');
      nav('/onboarding/auth/phone?mode=login', { replace: true });
      return;
    }
    try {
      sessionStorage.setItem('bw.session.phone', phone);
      localStorage.setItem('bw.lastPhone', phone);
      sessionStorage.removeItem('bw.logoutReason');
    } catch {}
    hydrateActiveFromCloud().catch(() => {});
    emit('bw:auth:changed', null);
    const back = computeBackRoute();
    nav(back, { replace: true });
  }

  function goOtp() {
    const redirect = computeBackRoute();
    try {
      sessionStorage.setItem('bw.auth.redirect', redirect);
    } catch {}
    nav(`/onboarding/auth/phone?mode=login`, { replace: true });
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <form
        onSubmit={continueSession}
        className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-6 space-y-4 shadow-lg animate-fade-up"
      >
        <h1 className="text-2xl font-bold">Resume your session</h1>
        <p className="text-sm text-gray-600">
          {phone
            ? `Welcome back. We’ll remember you on this device unless you log out or uninstall.`
            : 'Session expired. Continue with OTP to sign back in.'}
        </p>
        <button
          type="submit"
          disabled={!phone}
          className="w-full rounded-xl py-3 font-semibold bg-black text-white disabled:opacity-50"
        >
          {phone ? 'Continue' : 'Use OTP to sign in'}
        </button>
        <button
          type="button"
          onClick={goOtp}
          className="w-full rounded-xl py-3 font-semibold border border-black/20 text-black hover:bg-black/5"
          disabled={false}
        >
          Use OTP instead
        </button>
      </form>
    </div>
  );
}

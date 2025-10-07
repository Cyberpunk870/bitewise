import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import { clearPhoneSession, sendOtp } from '../../lib/firebase';
import { hasUser } from '../../lib/profileStore';

declare global {
  interface Window {
    grecaptcha?: { reset: (widgetId?: number) => void };
  }
}

export default function Phone() {
  const nav = useNavigate();
  const { setStep } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [phoneLocal10, setPhoneLocal10] = useState('');
  const [params] = useSearchParams();

  useEffect(() => setStep('phone'), [setStep]);

  // mark the flow: 'signup' (default) or 'login'
  const mode = (params.get('mode') === 'login' ? 'login' : 'signup') as 'login' | 'signup';
  useEffect(() => {
    sessionStorage.setItem('bw.auth.mode', mode);
  }, [mode]);

  // On unmount (or before re-render), reset any existing reCAPTCHA widget
  useEffect(() => {
    return () => {
      try { window.grecaptcha?.reset(); } catch {}
    };
  }, []);

  async function handleSend() {
    const local10 = phoneLocal10.replace(/\D/g, '').slice(-10);
    if (local10.length !== 10 || busy) return;

    setBusy(true);
    try {
      try { window.grecaptcha?.reset(); } catch {}

      clearPhoneSession();
      const e164 = '+91' + local10;

      // Guardrails based on agreed UX:
      // - If SIGNUP + number exists -> tell user and go to Welcome (start with Log in)
      if (mode === 'signup' && hasUser(e164)) {
        alert('This mobile number is already registered. Please use Log in.');
        // ensure we land on Welcome (manual flow) as discussed
        nav('/', { replace: true });
        return;
      }
      // - If LOGIN + number missing -> tell user and go to Welcome (start signup)
      if (mode === 'login' && !hasUser(e164)) {
        alert('We don’t recognize this number. Please Sign up first.');
        nav('/', { replace: true });
        return;
      }

      // otherwise proceed with OTP
      sessionStorage.setItem('bw.session.phone', e164);
      await sendOtp(e164);
      nav('/onboarding/auth/otp', { replace: true });
    } catch (err) {
      alert((err as Error).message || 'Could not send OTP. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardFrame
      step="phone"
      title={mode === 'login' ? 'Log in' : 'Verify your phone'}
      subtitle="Enter your mobile number"
      nextLabel="Send OTP"
      nextDisabled={phoneLocal10.replace(/\D/g, '').length < 10 || busy}
      onNext={handleSend}
      backTo="/onboarding"
    >
      <input
        id="phone-input"
        type="tel"
        inputMode="numeric"
        placeholder="10-digit mobile number"
        className="w-full rounded-xl border px-4 py-2 bg-white"
        disabled={busy}
        value={phoneLocal10}
        onChange={(e) => setPhoneLocal10(e.target.value.replace(/\D/g, '').slice(-10))}
      />

      {/* Hidden container for invisible reCAPTCHA (must exist in DOM) */}
      <div id="recaptcha-container" className="hidden" />
    </OnboardFrame>
  );
}

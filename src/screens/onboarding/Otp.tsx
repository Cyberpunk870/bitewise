import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import { confirmPhoneCode, waitForAuthSettle } from '../../lib/firebase';
import { loadProfileByPhone, saveProfile, setActivePhone, getLastRoute } from '../../lib/profileStore';
import { decidePerm } from '../../lib/permPrefs';

export default function Otp() {
  const nav = useNavigate();
  const { setStep } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setStep('otp'), [setStep]);

  async function handleVerify() {
    const c = code.replace(/\D/g, '').slice(0, 6);
    if (c.length < 6 || busy) return;
    setBusy(true);
    try {
      await confirmPhoneCode(c);
      await waitForAuthSettle();
      const phone = sessionStorage.getItem('bw.session.phone') ?? '';
      const mode = (sessionStorage.getItem('bw.auth.mode') || 'signup') as 'login' | 'signup';
      const existing = phone ? Boolean(loadProfileByPhone(phone)) : false;

      if (phone) setActivePhone(phone);
      sessionStorage.removeItem('bw.logoutReason');

      if (mode === 'login') {
        const needsPerms =
          decidePerm('location') === 'ask' ||
          decidePerm('notifications') === 'ask' ||
          decidePerm('mic') === 'ask';
        const last = getLastRoute();
        nav(needsPerms ? '/onboarding/perm/location' : (last || '/home'), { replace: true });
        return;
      }

      // signup
      if (existing && phone) {
        const last = getLastRoute();
        nav(last || '/home', { replace: true });
      } else {
        saveProfile({ phone, name: 'Guest', addressLine: '' });
        nav('/onboarding/perm/location', { replace: true });
      }
    } catch (err) {
      alert('Could not verify code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardFrame
      step="otp"
      title="Verify the code"
      subtitle="Enter the 6-digit code sent to your phone."
      nextLabel="Verify"
      nextDisabled={code.replace(/\D/g, '').length < 6 || busy}
      onNext={handleVerify}
      backTo="/onboarding/auth/phone"
    >
      <input
        ref={inputRef}
        id="otp-input"
        type="tel"
        inputMode="numeric"
        placeholder="Enter 6-digit code"
        className="w-full rounded-xl border px-4 py-2 bg-white"
        disabled={busy}
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </OnboardFrame>
  );
}

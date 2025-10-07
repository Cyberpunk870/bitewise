// src/screens/onboarding/SetPasskey.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import { setLocalPasskey } from '../../lib/passkeyLocal';

export default function SetPasskey() {
  const nav = useNavigate();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const phone = sessionStorage.getItem('bw.session.phone') || '';
    if (!phone) nav('/onboarding/auth/phone', { replace: true }); // WHY: passkey binds to phone
  }, [nav]);

  const validLen = pin.length >= 4 && pin.length <= 6;
  const match = pin === confirm;
  const canSave = validLen && match && !busy;

  async function handleSave() {
    if (!canSave) return;
    setBusy(true);
    try {
      const phone = sessionStorage.getItem('bw.session.phone') || '';
      await setLocalPasskey(phone, pin);
      localStorage.setItem('bw.lastPhone', phone); // WHY: used for quick-unlock
      nav('/onboarding/finish', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardFrame
      step="passkey"
      title="Set your passkey"
      subtitle="Create a 4–6 digit passkey to quickly unlock after inactivity."
      backTo="/onboarding/perm/mic"
      nextLabel="Save & continue"
      nextDisabled={!canSave}
      onNext={handleSave}
    >
      <div className="space-y-3 w-full">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          className="w-full rounded-xl border px-4 py-2 bg-white"
          placeholder="Enter 4–6 digit passkey"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          className="w-full rounded-xl border px-4 py-2 bg-white"
          placeholder="Re‑enter passkey"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
        />
        {!validLen && pin.length > 0 && (
          <p className="text-xs text-red-600">Passkey must be 4–6 digits.</p>
        )}
        {pin && confirm && !match && (
          <p className="text-xs text-red-600">Passkeys do not match.</p>
        )}
        <p className="text-xs text-gray-600">
          Stored securely on this device for quick unlock after a timeout. Use OTP to log in from other devices.
        </p>
      </div>
    </OnboardFrame>
  );
}

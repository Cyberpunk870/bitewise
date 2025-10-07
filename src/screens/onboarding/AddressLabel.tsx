// src/screens/onboarding/AddressLabel.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';

import useAddress from '../../store/address';
import type { AddressLabel as AddressLabelType } from '../../store/address';

const OPTIONS: AddressLabelType[] = ['Home', 'Work', 'Gym', 'Friend'];

export default function AddressLabel() {
  const nav = useNavigate();
  const { setStep } = useOnboarding();
  const { addressLine, setLabel } = useAddress();

  // Start blank; user must pick
  const [choice, setChoice] = useState<AddressLabelType | 'other' | ''>('');
  const [custom, setCustom] = useState('');

  useEffect(() => setStep('addressLabel'), [setStep]);

  const canNext =
    choice === 'other' ? custom.trim().length > 0 : choice !== '';

  function handleNext() {
    if (!canNext) return;
    const value =
      choice === 'other'
        ? ({ custom: custom.trim() } as const)
        : (choice as AddressLabelType);

    setLabel(value);
    nav('/onboarding/auth/phone', { replace: true });
  }

  return (
    <OnboardFrame
      step="addressLabel"
      backTo="/onboarding/address/pick"
      title="Save address as"
      subtitle={addressLine || 'No address set.'}
      nextLabel="Next"
      nextDisabled={!canNext}
      onNext={handleNext}
    >
      <div className="space-y-3">
        <label className="block text-sm">Label</label>

        <div className="relative">
          <select
            className="w-full appearance-none rounded-xl border bg-white/90 px-4 py-2"
            value={choice}
            onChange={(e) =>
              setChoice(e.target.value as AddressLabelType | 'other' | '')
            }
          >
            <option value="">Choose…</option>
            {OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            ▾
          </span>
        </div>

        {choice === 'other' && (
          <input
            className="w-full rounded-xl border px-4 py-2"
            placeholder="Custom label (e.g., Parents)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
      </div>
    </OnboardFrame>
  );
}

// src/screens/onboarding/AddressLabel.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import { setActiveProfileFields } from '../../lib/profileStore';
import { pushActiveToCloud } from '../../lib/cloudProfile';
import { getAuth } from 'firebase/auth';                // still fine to keep
import { addAddress as apiAddAddress } from '../../lib/api'; // NOTE: new shape (no uid arg)

const LABEL_SUGGESTIONS = ['Home', 'Work', 'PG', 'Parents', 'Friend', 'Gym', 'Other'];

export default function AddressLabel() {
  const nav = useNavigate();
  const ob: any = useOnboarding();
  const prefill =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('bw.labelPrompt.prefill')
      : null;
  const liveFlowFlag = typeof window !== 'undefined' ? sessionStorage.getItem('bw.liveAddress.flow') : null;
  const fromLiveUpdate = liveFlowFlag === 'label';

  // Optional store step handling
  useEffect(() => {
    try {
      ob?.setStep?.('addressLabel');
    } catch {}
  }, [ob]);

  // Read existing values from onboarding store (fallbacks are safe)
  const addressLine = ob?.addressLine || '';
  const lat = ob?.lat ?? null;
  const lng = ob?.lng ?? null;
  const currentLabel = ob?.addressLabel || '';
  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem('bw.labelPrompt.prefill'); } catch {}
    };
  }, []);

  // Dropdown + optional custom label
  const initialLabel = currentLabel || prefill || '';
  const normalizedInitial = initialLabel.toLowerCase();
  const matchedPreset =
    LABEL_SUGGESTIONS.find((s) => s.toLowerCase() === normalizedInitial) ||
    (initialLabel ? 'Other' : 'Home');
  const [selected, setSelected] = useState<string>(matchedPreset);

  const [customLabel, setCustomLabel] = useState(
    matchedPreset === 'Other' ? initialLabel : ''
  );

  const effectiveLabel = selected === 'Other' ? customLabel.trim() : selected;

  // Allow progress even if lat/lng are missing (e.g., live label prompt), but skip backend upsert in that case.
  const canProceed = !!(addressLine && effectiveLabel);

  async function handleContinue() {
    if (!canProceed) return;

    // 1. update onboarding store + local active profile
    try {
      ob?.setAddressLabel?.(effectiveLabel);
    } catch {}

    setActiveProfileFields({
      addressLine,
      addressLabel: effectiveLabel,
      lat,
      lng,
    });

    // 2. push profile snapshot up (best-effort, non-blocking)
    try {
      await pushActiveToCloud();
    } catch (err) {
      console.warn('Cloud sync deferred', err);
    }

    // 3. NEW: also persist this address in backend (which writes Firestore)
    // backend will read uid from the bearer token, we do NOT pass uid here
    try {
      const uid = getAuth().currentUser?.uid;
      if (uid && lat != null && lng != null) {
        await apiAddAddress({
          label: effectiveLabel,
          addressLine,
          lat,
          lng,
          active: true, // first onboarding address → make active by default
        });
        console.log('✅ Address upserted for onboarding user');
      } else {
        console.warn('⚠️ Skipped Firestore upsert: missing auth or coords');
      }
    } catch (err) {
      console.warn('⚠️ Failed to upsert onboarding address:', err);
    }

    try { sessionStorage.removeItem('bw.pending.liveAddress'); } catch {}

    // 4. continue onboarding flow
    if (fromLiveUpdate) {
      try { sessionStorage.removeItem('bw.liveAddress.flow'); } catch {}
      nav('/home', { replace: true });
      return;
    }

    nav('/onboarding/perm/location', { replace: true });
  }

  return (
    <OnboardFrame
      step="addressLabel"
      backTo="/onboarding/address/pick"
      title="Label this address"
      subtitle="Pick a label or enter a custom one."
      nextLabel="Continue"
      nextDisabled={!canProceed}
      onNext={handleContinue}
    >
      <div className="w-full max-w-md mx-auto space-y-4">
        <label className="block text-sm font-medium mb-1">Choose a label</label>
        <select
          className="w-full rounded-xl border px-4 py-2 bg-white"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {LABEL_SUGGESTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {selected === 'Other' && (
          <input
            type="text"
            className="w-full rounded-xl border px-4 py-2 bg-white"
            placeholder="Type custom label (e.g. 'Hostel B-203')"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
          />
        )}

        <p className="text-xs opacity-70">
          This helps you quickly identify and switch between saved locations.
        </p>
      </div>
    </OnboardFrame>
  );
}

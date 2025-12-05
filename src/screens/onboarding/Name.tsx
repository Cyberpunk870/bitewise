// src/screens/onboarding/Name.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import { setActiveProfileFields, getActiveProfile } from '../../lib/profileStore';
import { pushActiveToCloud } from '../../lib/cloudProfile';

export default function Name() {
  const nav = useNavigate();
  const current = getActiveProfile();
  const [name, setName] = useState(current?.name || '');

  const canNext = name.trim().length >= 2;

  async function onNext() {
    if (!canNext) return;
    setActiveProfileFields({ name: name.trim() });
    try { await pushActiveToCloud(); } catch {}
    nav('/onboarding/dob', { replace: true });
  }

  return (
    <OnboardFrame
      step="name"
      backTo="/onboarding"
      title="What should we call you?"
      subtitle="Your name helps personalize your experience."
      nextLabel="Continue"
      nextDisabled={!canNext}
      onNext={onNext}
    >
      <div className="w-full max-w-md mx-auto space-y-3">
        <input
          className="w-full rounded-xl border px-4 py-2 bg-white"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
    </OnboardFrame>
  );
}

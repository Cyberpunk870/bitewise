import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import { useOnboarding } from '../../store/onboarding';

export default function Name() {
  const nav = useNavigate();
  const { name: stored, setName, setStep } = useOnboarding();
  const [name, setLocal] = useState(stored ?? '');

  useEffect(() => setStep('name'), [setStep]);

  const handleNext = () => {
    const v = name.trim();
    if (!v) return;
    setName(v);
    nav('/onboarding/dob', { replace: true });
  };

  return (
    <OnboardFrame
      step="name"
      backTo="/"
      title="Let’s get to know you"
      subtitle="Enter your name"
      nextDisabled={!name.trim()}
      onNext={handleNext}
    >
      <input
        type="text"
        className="w-full rounded-xl border px-4 py-2 bg-white"
        value={name}
        placeholder="Full name"
        onChange={(e) => setLocal(e.target.value)}
      />
    </OnboardFrame>
  );
}

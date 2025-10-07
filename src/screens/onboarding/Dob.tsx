import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';

export default function Dob() {
  const nav = useNavigate();
  const { dob: stored, setDob, setStep } = useOnboarding();
  const [dob, setLocal] = useState(stored ?? '');

  // Ensure progress bar knows which step this is
  useEffect(() => { setStep('dob'); }, [setStep]);

  // Age limits: 13–100 yrs
  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  }, [today]);
  const minDate = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - 100);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const isValidDob = (v: string) => {
    if (!v) return false;
    const d = new Date(v);
    if (isNaN(d.getTime())) return false;
    // ISO yyyy-mm-dd strings can be compared lexicographically
    return v >= minDate && v <= maxDate;
  };

  const handleNext = () => {
    if (!isValidDob(dob)) return;
    setDob(dob);
    nav('/onboarding/address/pick', { replace: true });
  };

  return (
    <OnboardFrame
      step="dob"
      backTo="/onboarding/name"
      title="What’s your date of birth?"
      subtitle="We use this to personalise your experience."
      nextDisabled={!isValidDob(dob)}
      onNext={handleNext}
    >
      <input
        type="date"
        className="w-full rounded-xl border px-4 py-2 bg-white"
        value={dob}
        onChange={(e) => setLocal(e.target.value)}
        min={minDate}
        max={maxDate}
        inputMode="none"
      />
      {!isValidDob(dob) && dob && (
        <p className="mt-2 text-sm text-red-600">
          Please pick a valid date (13–100 years).
        </p>
      )}
    </OnboardFrame>
  );
}

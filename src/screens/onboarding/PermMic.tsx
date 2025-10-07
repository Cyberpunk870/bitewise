// src/screens/onboarding/PermMic.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import { setPermPolicy, type PermPolicy, decidePerm } from '../../lib/permPrefs';

type Choice = PermPolicy | null;

export default function PermMic() {
  const nav = useNavigate();
  const { setStep, setPerm } = useOnboarding();
  const [choice, setChoice] = useState<Choice>(null);

  useEffect(() => setStep('permMic'), [setStep]);

  // Helper: where to go after this screen
  function nextRoute() {
    const mode = (sessionStorage.getItem('bw.auth.mode') || 'signup') as 'signup' | 'login';
    return mode === 'signup' ? '/onboarding/setpasskey' : '/home';
    // login => Home; signup => Set Passkey
  }

  // If this permission is already decided (always/never or session flag active),
  // skip the screen but route correctly by mode.
  useEffect(() => {
    if (decidePerm('mic') !== 'ask') {
      nav(nextRoute(), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNext() {
    if (!choice) return;

    // Persist the preference
    setPermPolicy('mic', choice);

    // Reflect status in the onboarding store (no auto browser prompt here)
    setPerm('mic', choice === 'never' ? 'denied' : 'granted');

    nav(nextRoute(), { replace: true });
  }

  return (
    <OnboardFrame
      step="permMic"
      backTo="/onboarding/perm/notifications"
      title="Microphone (optional)"
      subtitle="Voice search, future."
      nextLabel="Next"
      nextDisabled={!choice}
      onNext={handleNext}
    >
      <div className="flex flex-col gap-3">
        {(['always','session','never'] as PermPolicy[]).map(opt => {
          const selected = choice === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setChoice(opt)}
              className={`w-full rounded-xl border px-4 py-3 transition ${selected ? 'bg-black text-white' : 'bg-transparent hover:bg-white/10'}`}
            >
              {opt === 'always' ? 'Allow while using the app'
               : opt === 'session' ? 'Only this time'
               : "Don't allow"}
            </button>
          );
        })}
      </div>
    </OnboardFrame>
  );
}

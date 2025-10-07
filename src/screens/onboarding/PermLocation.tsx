import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import { setPermPolicy, type PermPolicy, decidePerm } from '../../lib/permPrefs';

type Choice = PermPolicy | null;

export default function PermLocation() {
  const nav = useNavigate();
  const { setStep, setPerm } = useOnboarding();
  const [choice, setChoice] = useState<Choice>(null);

  useEffect(() => setStep('permLocation'), [setStep]);

  // If this permission has already been decided (always/never or an active session flag),
  // skip this screen immediately.
  useEffect(() => {
    if (decidePerm('location') !== 'ask') {
      goNext(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext = choice != null;

  async function goNext(skipSelf = false) {
    if (!skipSelf) {
      // Persist choice (session vs persistent) and reflect in onboarding store.
      setPermPolicy('location', choice as PermPolicy);
      setPerm('location', choice === 'never' ? 'denied' : 'granted');

      // (Optional) If they picked an allow-ish option, you can nudge the browser now.
      // This is safe on https and on localhost.
      if (choice !== 'never' && 'geolocation' in navigator) {
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              () => resolve() // ignore errors; we'll respect policy via decidePerm elsewhere
            );
          });
        } catch {}
      }
    }

    // Continue to Notifications step (it will also auto-skip if already decided).
    nav('/onboarding/perm/notifications', { replace: true });
  }

  return (
    <OnboardFrame
      step="permLocation"
      backTo="/onboarding/auth/phone"
      title="Location"
      subtitle="Allow to show nearby options & delivery distance."
      nextLabel="Next"
      nextDisabled={!canNext}
      onNext={() => goNext(false)}
    >
      <div className="space-y-3">
        {(['never', 'session', 'always'] as PermPolicy[]).map(opt => {
          const selected = choice === opt;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={selected}
              onClick={() => setChoice(opt)}
              className={`w-full rounded-xl border px-4 py-3 transition ${
                selected ? 'bg-black text-white' : 'bg-transparent hover:bg-white/10'
              }`}
            >
              {opt === 'never'
                ? "Don't allow"
                : opt === 'session'
                ? 'Only this time'
                : 'Allow while using the app'}
            </button>
          );
        })}
      </div>
    </OnboardFrame>
  );
}

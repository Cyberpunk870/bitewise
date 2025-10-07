// src/screens/onboarding/PermNotifications.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import useOnboarding from '../../store/onboarding';
import {
  setPermPolicy,
  decidePerm,
  type PermPolicy,
} from '../../lib/permPrefs';

type Choice = PermPolicy | null;

export default function PermNotifications() {
  const nav = useNavigate();
  const { setStep, setPerm } = useOnboarding();
  const [choice, setChoice] = useState<Choice>(null);

  useEffect(() => setStep('permNotifications'), [setStep]);

  // ✅ Skip if this permission is already decided for this tab/session
  useEffect(() => {
    if (decidePerm('notifications') !== 'ask') {
      goNext(true); // don't re-write state; just advance
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext = choice != null;

  async function goNext(skipSelf = false) {
    if (!skipSelf) {
      // 1) Persist user’s UI choice (always/never -> localStorage, session -> sessionStorage)
      setPermPolicy('notifications', choice as PermPolicy);

      // 2) Reflect in onboarding store and (optionally) talk to browser
      if (choice === 'never') {
        setPerm('notifications', 'denied');
      } else if (choice === 'session') {
        // Session-only: allow inside the app for this tab, but DO NOT call the browser prompt
        setPerm('notifications', 'granted');
      } else {
        // 'always' -> request browser permission if possible, mirror the real result
        if (
          typeof Notification !== 'undefined' &&
          typeof Notification.requestPermission === 'function'
        ) {
          try {
            const res = await Notification.requestPermission();
            setPerm('notifications', res === 'granted' ? 'granted' : 'denied');
          } catch {
            setPerm('notifications', 'granted'); // best effort fallback
          }
        } else {
          setPerm('notifications', 'granted');
        }
      }
    }

    // Continue to Mic
    nav('/onboarding/perm/mic', { replace: true });
  }

  return (
    <OnboardFrame
      step="permNotifications"
      backTo="/onboarding/perm/location"
      title="Notifications"
      subtitle="Order updates."
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
              className={[
                'w-full rounded-xl border px-4 py-3 transition',
                selected ? 'bg-black text-white' : 'bg-transparent hover:bg-white/10',
              ].join(' ')}
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

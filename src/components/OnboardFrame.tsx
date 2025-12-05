// src/components/OnboardFrame.tsx
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import useOnboarding, { PROGRESSION_STEPS, type OnboardStep } from '../store/onboarding';

type Props = {
  title: string;
  subtitle?: string;
  /** Explicit step key for this screen (recommended). Falls back to store.step */
  step?: OnboardStep;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void;
  children: ReactNode;
  /** Explicit back target to avoid history surprises */
  backTo?: string;
  /** Show the Back link (default true) */
  showBack?: boolean;
  /** Show step + bar (default true) */
  showProgress?: boolean;
};

export default function OnboardFrame({
  title,
  subtitle,
  step,
  nextLabel = 'Next',
  nextDisabled,
  onNext,
  children,
  backTo,
  showBack = true,
  showProgress = true,
}: Props) {
  const nav = useNavigate();
  const store = useOnboarding();

  const activeStep: OnboardStep = step ?? store.step;
  const idx = PROGRESSION_STEPS.findIndex(s => s === activeStep);
  const total = PROGRESSION_STEPS.length;
  const canCompute = idx >= 0 && idx < total;
  const percent = canCompute ? Math.min(100, Math.max(0, ((idx + 1) / total) * 100)) : 0;

  function handleBack() {
    if (backTo) nav(backTo, { replace: true });
    else nav(-1);
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        {showProgress && canCompute && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm">
              {showBack ? (
                <button onClick={handleBack} className="underline underline-offset-2">
                  Back
                </button>
              ) : (
                <span />
              )}
              <span>
                Step {idx + 1} of {total}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded bg-white/40">
              <div
                className="h-full rounded bg-black"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm opacity-80">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {onNext && (
          <button
            onClick={onNext}
            disabled={!!nextDisabled}
            className={`mt-6 w-full rounded-xl px-4 py-3 border ${
              nextDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 bg-black text-white'
            }`}
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
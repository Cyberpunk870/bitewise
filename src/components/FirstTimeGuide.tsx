// src/components/FirstTimeGuide.tsx
import React, { useEffect, useMemo, useState } from 'react';

type StepConfig = {
  id: string;
  title: string;
  body: string;
  actionLabel?: string;
  action?: string;
};

type Props = {
  steps: StepConfig[];
  onDismiss: () => void;
  onAction?: (action: string) => void;
};

export default function FirstTimeGuide({ steps, onDismiss, onAction }: Props) {
  const [index, setIndex] = useState(0);

  const step = steps[index];
  const total = steps.length;

  useEffect(() => {
    if (!step) return;
    const id = window.setTimeout(() => {
      setIndex((prev) => {
        if (prev >= steps.length - 1) return prev;
        return prev + 1;
      });
    }, 6000);
    return () => window.clearTimeout(id);
  }, [step, steps.length]);

  const indicators = useMemo(() => steps.map((s) => s.id), [steps]);

  if (!step) return null;

  const handleNext = () => {
    if (index >= total - 1) {
      onDismiss();
    } else {
      setIndex((i) => Math.min(total - 1, i + 1));
    }
  };

  return (
    <aside className="fixed bottom-4 left-4 z-[140] max-w-xs rounded-2xl border border-white/15 bg-[#0b1224]/90 p-4 text-white shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-1">
            Step {index + 1}/{total}
          </p>
          <h3 className="text-lg font-semibold">{step.title}</h3>
        </div>
        <button
          className="text-sm text-white/60 hover:text-white"
          type="button"
          onClick={onDismiss}
        >
          Skip
        </button>
      </div>
      <p className="text-sm text-white/80 mt-2">{step.body}</p>
      <div className="mt-4 flex items-center gap-2">
        {step.actionLabel && (
          <button
            type="button"
            className="flex-1 rounded-xl bg-white text-black text-sm font-semibold py-2 shadow"
            onClick={() => step.action && onAction?.(step.action)}
          >
            {step.actionLabel}
          </button>
        )}
        <button
          type="button"
          className="rounded-xl border border-white/30 px-4 py-2 text-sm text-white/80 hover:text-white"
          onClick={handleNext}
        >
          {index >= total - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
      <div className="mt-3 flex gap-1">
        {indicators.map((id, idx) => (
          <span
            key={id}
            className={[
              'h-1.5 flex-1 rounded-full',
              idx <= index ? 'bg-white' : 'bg-white/30',
            ].join(' ')}
          />
        ))}
      </div>
    </aside>
  );
}

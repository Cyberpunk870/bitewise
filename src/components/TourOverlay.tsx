import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../store/tour';

type Rect = { top: number; left: number; width: number; height: number };

function useTargetRect(selector: string) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const box = el.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };
    update();
    const id = window.setInterval(update, 400);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [selector]);
  return rect;
}

export default function TourOverlay() {
  const { steps, index, active, next, back, stop } = useTour();
  const step = useMemo(() => steps[index], [steps, index]);
  const selector = step?.selector || '';
  const rect = useTargetRect(selector);

  if (!active || !step || !selector) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000]">
      {rect ? (
        <div
          className="absolute rounded-xl border-2 border-white/80"
          onClick={stop}
          style={{
            top: rect.top - 8 + window.scrollY,
            left: rect.left - 8 + window.scrollX,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/50" onClick={stop} />
      )}
      <div
        className="absolute max-w-sm bg-white text-black rounded-2xl shadow-2xl p-4 space-y-2 pointer-events-auto"
        style={{
          top: rect ? rect.top + rect.height + 16 + window.scrollY : window.innerHeight / 2,
          left: rect ? rect.left + window.scrollX : window.innerWidth / 2 - 150,
        }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
          Step {index + 1} of {steps.length}
        </p>
        <h3 className="text-lg font-semibold">{step.title}</h3>
        <p className="text-sm text-gray-700">{step.body}</p>
        <div className="flex items-center justify-between pt-2">
          <button
            className="px-3 py-1.5 rounded-full border border-gray-300 text-sm"
            onClick={index === 0 ? stop : back}
          >
            {index === 0 ? 'Skip tour' : 'Back'}
          </button>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-full border border-gray-300 text-xs md:text-sm"
              onClick={stop}
            >
              Don&apos;t show again
            </button>
            <button className="px-3 py-1.5 rounded-full bg-black text-white text-sm" onClick={next}>
              {index === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

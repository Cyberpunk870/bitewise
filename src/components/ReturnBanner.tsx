// src/components/ReturnBanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { on } from '../lib/events';
import { getPendingReturn, confirmOrderPlaced, clearPendingReturn } from '../lib/orderReturn';

export default function ReturnBanner() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState<string>('');
  const timerRef = useRef<number | null>(null);
   // auto-dismiss timer once visible
  const autoHideRef = useRef<number | null>(null);

  const showWithDelay = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
    }, 1200); // slight delay to avoid instant popup
  };

  const refresh = () => {
    const ctx = getPendingReturn();
    if (!ctx) { setVisible(false); return; }
    const saved = Math.max(0, Math.round(ctx.delta ?? 0));
    const plat = ctx.platform[0].toUpperCase() + ctx.platform.slice(1);
    setLabel(saved > 0 ? `Placed on ${plat}? Saved ~₹${saved}?` : `Placed on ${plat}?`);
    showWithDelay();
  };

  useEffect(() => {
    // show when page becomes visible or Compare just marked outbound
    const off1 = on('bw:return:possible', refresh);
    const off2 = on('bw:compare:done', () => setTimeout(refresh, 0));
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    // also try once on mount
    refresh();
    return () => {
      off1(); off2();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (autoHideRef.current) window.clearTimeout(autoHideRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // when visible, schedule an auto-dismiss so it doesn't stick forever
  useEffect(() => {
    if (visible) {
      if (autoHideRef.current) window.clearTimeout(autoHideRef.current);
      autoHideRef.current = window.setTimeout(() => {
        setVisible(false);
      }, 9000); // auto-hide after ~9s
    } else {
      if (autoHideRef.current) {
        window.clearTimeout(autoHideRef.current);
        autoHideRef.current = null;
      }
    }
    return () => {
      if (autoHideRef.current) window.clearTimeout(autoHideRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-40 px-3">
      <div className="relative flex flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl px-4 py-3 text-white shadow-xl shadow-black/30">
        <div className="flex-1 min-w-[220px]">
          <div className="text-sm font-medium">{label}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-sm rounded-full bg-white text-black px-3 py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={async () => {
              try { await confirmOrderPlaced(); } catch {}
              setVisible(false);
            }}
            aria-label="Confirm order placed"
          >
            I placed it
          </button>
          <button
            className="text-sm rounded-full border border-white/30 px-3 py-1 text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => {
              try { clearPendingReturn(); } catch {}
              setVisible(false);
            }}
            aria-label="Skip for now"
          >
            Skip for now
          </button>
        </div>
        <button
          className="absolute top-2 right-2 text-xs text-white/60 hover:text-white"
          onClick={() => {
            try { clearPendingReturn(); } catch {}
            setVisible(false);
          }}
          aria-label="Close banner"
        >
          ×
        </button>
      </div>
    </div>
  );
}

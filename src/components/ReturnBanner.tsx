// src/components/ReturnBanner.tsx
import React, { useEffect, useState } from 'react';
import { on } from '../lib/events';
import { getPendingReturn, confirmOrderPlaced, clearPendingReturn } from '../lib/orderReturn';

export default function ReturnBanner() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState<string>('');

  const refresh = () => {
    const ctx = getPendingReturn();
    if (!ctx) { setVisible(false); return; }
    const saved = Math.max(0, Math.round(ctx.delta ?? 0));
    const plat = ctx.platform[0].toUpperCase() + ctx.platform.slice(1);
    setLabel(saved > 0 ? `Placed on ${plat}? Saved ~₹${saved}?` : `Placed on ${plat}?`);
    setVisible(true);
  };

  useEffect(() => {
    // show when page becomes visible or Compare just marked outbound
    const off1 = on('bw:return:possible', refresh);
    const off2 = on('bw:compare:done', () => setTimeout(refresh, 0));
    // also try once on mount
    refresh();
    return () => { off1(); off2(); };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-3 z-40 px-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl px-4 py-2 text-white shadow-xl shadow-black/30">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <button
            className="text-sm rounded-full bg-white text-black px-3 py-1 font-semibold"
            onClick={async () => {
              try { await confirmOrderPlaced(); } catch {}
              setVisible(false);
            }}
          >
            I placed it
          </button>
          <button
            className="text-sm rounded-full border border-white/30 px-3 py-1 text-white/80"
            onClick={() => {
              try { clearPendingReturn(); } catch {}
              setVisible(false);
            }}
          >
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}

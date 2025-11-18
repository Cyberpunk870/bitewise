// src/screens/home/sections/YummiBotTeaser.tsx
import React from 'react';

function fireYummiBot() {
  try {
    window.dispatchEvent(new CustomEvent('bw:yummibot:open'));
  } catch {}
}

export default function YummiBotTeaser() {
  return (
    <button
      type="button"
      onClick={fireYummiBot}
      className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#ec4899] via-[#8b5cf6] to-[#0ea5e9] p-5 text-left text-white shadow-xl shadow-black/30 hover:scale-[1.01] transition-transform"
    >
      <p className="text-xs uppercase tracking-[0.4em] text-white/70">Assistant</p>
      <h3 className="text-xl font-semibold mt-1">Ask YummiBot</h3>
      <p className="text-sm text-white/80 mt-1">
        Get dish ideas, find cuisines, and compare platforms with a single prompt.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
        Summon YummiBot
        <span aria-hidden="true">→</span>
      </div>
    </button>
  );
}

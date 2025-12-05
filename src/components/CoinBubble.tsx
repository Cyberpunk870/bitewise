// src/components/CoinBubble.tsx
import React, { useEffect, useState } from 'react';
import { getTokens } from '../lib/tokens';

function CoinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.15" />
      <path d="M8 12a4 4 0 1 0 8 0" />
      <path d="M12 7v10" />
    </svg>
  );
}

export default function CoinBubble({ onClick }: { onClick?: () => void }) {
  const [tokens, setTokens] = useState(() => getTokens());
  useEffect(() => {
    const refresh = () => setTokens(getTokens());
    window.addEventListener('bw:tokens:update', refresh as any);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('bw:tokens:update', refresh as any);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Your Bits"
      className="relative h-9 rounded-full bg-white/95 border shadow px-2 flex items-center gap-1.5"
      style={{ minWidth: 54 }}
    >
      <span className="grid place-items-center rounded-full h-7 w-7 bg-black/90 text-white">
        <CoinIcon />
      </span>
      <span className="text-sm font-medium tabular-nums">{tokens}</span>
    </button>
  );
}

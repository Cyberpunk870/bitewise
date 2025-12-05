import React from 'react';

type Props = { offline: boolean };

export default function OfflineTooltip({ offline }: Props) {
  if (!offline) return null;
  return (
    <div className="fixed bottom-4 right-4 rounded-xl bg-white/10 border border-white/20 text-white/80 text-xs px-3 py-2 shadow-lg backdrop-blur-md">
      Offline mode: browsing works; actions queue until you reconnect.
    </div>
  );
}

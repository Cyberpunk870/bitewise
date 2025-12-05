import React from 'react';

type Props = {
  offline: boolean;
};

export default function OfflineBanner({ offline }: Props) {
  if (!offline) return null;
  return (
    <div className="w-full bg-amber-500/20 border-b border-amber-300/40 text-amber-100 text-sm px-4 py-2 text-center backdrop-blur-md">
      You’re offline. Some actions (orders, tasks, push) won’t update until you reconnect.
    </div>
  );
}

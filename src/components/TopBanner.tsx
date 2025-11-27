import React, { useEffect, useState } from 'react';

export default function TopBanner({
  text,
  seconds = 2,
  onDone,
}: { text: string; seconds?: number; onDone?: () => void }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => { setShow(false); onDone?.(); }, seconds * 1000);
    return () => clearTimeout(id);
  }, [seconds, onDone]);
  if (!show) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60]">
      <div className="rounded-full bg-black text-white text-sm px-4 py-2 shadow-lg" role="status" aria-live="polite">
        {text}
      </div>
    </div>
  );
}

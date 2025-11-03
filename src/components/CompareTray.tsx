// src/components/CompareTray.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCart from '../store/cart';

export default function CompareTray() {
  const nav = useNavigate();
  const { items, count } = useCart();

  // build list of unique ids in cart
  const ids = useMemo(
    () => Array.from(new Set(items.map((it) => String(it.id)))),
    [items]
  );

  if (count < 2) return null; // show only when it's useful

  return (
    <div className="fixed left-3 bottom-3">
      <button
        onClick={() =>
          nav(`/compare?ids=${encodeURIComponent(ids.join(','))}`)
        }
        className="rounded-full bg-black text-white px-4 py-2 shadow-lg hover:opacity-90"
      >
        Compare ({count})
      </button>
    </div>
  );
}
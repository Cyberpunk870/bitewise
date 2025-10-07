import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../store/cart';

export default function CompareTray() {
  const nav = useNavigate();
  const cart = useCart();
  const count = cart.totalCount();

  const ids = useMemo(() => cart.allIds(), [cart]);

  if (count < 2) return null; // show only when it’s useful

  return (
    <div className="fixed left-3 bottom-3">
      <button
        onClick={() => nav(`/compare?ids=${encodeURIComponent(ids.join(','))}`)}
        className="rounded-full bg-black text-white px-4 py-2 shadow-lg hover:opacity-90"
      >
        Compare ({count})
      </button>
    </div>
  );
}

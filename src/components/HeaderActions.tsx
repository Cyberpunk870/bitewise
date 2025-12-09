import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CoinIcon from './CoinIcon';
import { emit } from '../lib/events';
import useCart from '../store/cart';

type Props = {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  priceMax: number;
  ratingMin: number;
  distanceMax: number;
  setPriceMax: (v: number) => void;
  setRatingMin: (v: number) => void;
  setDistanceMax: (v: number) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  logout: () => Promise<void>;
  tokens: number;
  cartId?: string;
  menuId?: string;
};

const CartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="9" cy="20" r="1.8" />
    <circle cx="18" cy="20" r="1.8" />
    <path d="M3 4h2l2.6 11.2A2 2 0 0 0 9.6 17H18a2 2 0 0 0 2-1.6L21 9H7" />
  </svg>
);

const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" role="img" aria-label="Menu" {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export default function HeaderActions({
  menuOpen,
  setMenuOpen,
  priceMax,
  ratingMin,
  distanceMax,
  setPriceMax,
  setRatingMin,
  setDistanceMax,
  applyFilters,
  resetFilters,
  logout,
  tokens,
  cartId,
  menuId,
}: Props) {
  const nav = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { count } = useCart();

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [setMenuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="justify-self-end flex items-center gap-3 relative">
      {/* Bites / coins */}
      <button
        onClick={() => {
          emit('bw:open:tasks', null);
          nav('/tasks');
        }}
        className="h-9 min-w-[48px] px-3 grid grid-cols-[16px_auto] items-center gap-1 rounded-full border border-white/40 bg-white/90 text-slate-900 shadow-[0_10px_30px_rgba(5,9,20,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
        title="Your Bites"
        aria-label="Your Bites"
        id="nav-bites"
      >
        <CoinIcon className="h-4 w-4" />
        <span className="text-xs font-semibold">{tokens}</span>
      </button>

      {/* Cart */}
      <button
        type="button"
        className="relative h-9 w-10 grid place-items-center rounded-xl border border-white/40 bg-white/90 text-slate-900 shadow-[0_10px_30px_rgba(5,9,20,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
        onClick={() => nav('/cart')}
        title="Cart"
        aria-label="Cart"
        id={cartId}
      >
        <CartIcon />
        {count > 0 && (
          <span className="absolute translate-x-3 -translate-y-3 text-[10px] bg-rose-500 text-white rounded-full px-1 py-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            {count}
          </span>
        )}
      </button>

      {/* Hamburger / Menu */}
      <div className="relative">
        <button
          type="button"
          className="h-9 w-10 grid place-items-center rounded-xl border border-white/40 bg-white/90 text-slate-900 shadow-[0_10px_30px_rgba(5,9,20,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Menu"
          id={menuId}
        >
          <MenuIcon />
        </button>

        {menuOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex" onClick={closeMenu}>
            <div
              ref={menuRef}
              role="menu"
              aria-label="BiteWise menu"
              className="ml-auto h-full w-full sm:w-[min(360px,80vw)] bg-[#050712] rounded-none sm:rounded-l-3xl shadow-xl flex flex-col text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Menu header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10">
                <div className="text-base font-semibold">Menu</div>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-white/10 hover:bg-white/20"
                >
                  Close
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
                <div className="grid gap-2">
                  <NavLink to="/notifications" label="Notifications" close={closeMenu} />
                  <NavLink to="/tasks" label="Missions" close={closeMenu} />
                  <NavLink to="/leaderboard" label="Leaderboard" close={closeMenu} />
                  <NavLink to="/achievements" label="Achievements" close={closeMenu} />
                  <NavLink to="/orders/history" label="Order history" close={closeMenu} />
                  <NavLink to="/feedback" label="Send feedback" close={closeMenu} />
                  <NavLink to="/settings" label="Settings" close={closeMenu} id="nav-settings" />
                  {/* Analytics UI disabled; data is stored in Firestore for investor reporting */}

                  <details className="mt-1 rounded-xl border border-white/15 bg-white/5 open:shadow-inner">
                    <summary className="cursor-pointer px-3 py-2 rounded text-sm text-white/90 hover:bg-white/10 select-none">
                      Filter
                    </summary>
                    <div className="p-3 pt-1 grid gap-4">
                      <Slider
                        label="Price"
                        suffix={`≤ ₹${priceMax}`}
                        min={50}
                        max={1500}
                        step={10}
                        value={priceMax}
                        onChange={setPriceMax}
                      />
                      <Slider
                        label="Rating"
                        suffix={`≥ ${ratingMin.toFixed(1)}`}
                        min={0}
                        max={5}
                        step={0.1}
                        value={ratingMin}
                        onChange={setRatingMin}
                      />
                      <Slider
                        label="Distance"
                        suffix={`≤ ${distanceMax} km`}
                        min={1}
                        max={20}
                        step={1}
                        value={distanceMax}
                        onChange={setDistanceMax}
                      />
                      <div className="flex items-center justify-between">
                        <button
                          className="px-3 py-2 rounded border border-white/20 text-white/80 hover:bg-white/10"
                          onClick={resetFilters}
                        >
                          Reset
                        </button>
                        <button
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc] text-[#0b1120] font-semibold shadow-lg shadow-rose-500/30"
                          onClick={applyFilters}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </details>

                  <button
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10 transition"
                    onClick={() => {
                      closeMenu();
                      logout();
                    }}
                  >
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NavLink({ to, label, close, id }: { to: string; label: string; close: () => void; id?: string }) {
  return (
    <Link
      to={to}
      id={id}
      onClick={close}
      className="block rounded-xl px-3 py-2 text-sm text-white/85 hover:bg-white/10 transition"
    >
      {label}
    </Link>
  );
}

function Slider({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-medium text-white">{label}</p>
        <p className="text-xs text-white/60">{suffix}</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="w-full accent-pink-200"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}


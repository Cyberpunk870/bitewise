// src/components/AppHeader.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../store/cart';
import { getActiveProfile } from '../lib/profileStore';
import { clearSessionPerms, decidePerm } from '../lib/permPrefs';
import { getBadgeCounts } from '../lib/badgeCounts';
import { addNotice } from '../lib/notifications';
import CoinIcon from './CoinIcon';

/* icons */
function MicIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 19v3" />
    </svg>
  );
}
function CartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="9" cy="20" r="1.8" />
      <circle cx="18" cy="20" r="1.8" />
      <path d="M3 4h2l2.6 11.2A2 2 0 0 0 9.6 17H18a2 2 0 0 0 2-1.6L21 9H7" />
    </svg>
  );
}
function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function BurgerAvatar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" {...props}>
      <circle cx="32" cy="32" r="31" fill="#FFD18A" />
      <rect x="12" y="28" width="40" height="12" rx="6" fill="#8B5E3C" />
      <rect x="14" y="24" width="36" height="7" rx="3.5" fill="#D94F2B" />
      <rect x="14" y="40" width="36" height="7" rx="3.5" fill="#F2C94C" />
      <circle cx="24" cy="22" r="2" fill="#333" />
      <circle cx="40" cy="22" r="2" fill="#333" />
    </svg>
  );
}

/* dispatch helpers for search/filters */
function fire<T>(name: string, detail: T) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

export default function AppHeader() {
  const nav = useNavigate();
  const { count } = useCart();

  /* profile */
  const [profile, setProfile] = useState(() => getActiveProfile());
  useEffect(() => {
    const refresh = () => setProfile(getActiveProfile());
    window.addEventListener('storage', refresh);
    window.addEventListener('bw:profile:update' as any, refresh as any);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('bw:profile:update' as any, refresh as any);
    };
  }, []);
  const name = profile?.name || 'Guest';
  const addressLine = profile?.addressLine || '';
  const addressLabel = profile?.addressLabel || '';

  /* search */
  const [placeholder, setPlaceholder] = useState('Search dishes...');
  const [inputValue, setInputValue] = useState('');
  const [suggest, setSuggest] = useState('');
  const dishNamesRef = useRef<string[]>([]);
  useEffect(() => {
    const PROMPTS = [
      'Try “chicken biryani”',
      'Search “best value pizza”',
      'Say “paneer butter masala”',
      'Find “veg momos”',
    ];
    let i = 0;
    const id = setInterval(() => { setPlaceholder(PROMPTS[i % PROMPTS.length]); i += 1; }, 2800);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const onNames = (e: Event) => { dishNamesRef.current = ((e as CustomEvent).detail as string[]) || []; };
    window.addEventListener('bw:dishes:names' as any, onNames);
    return () => window.removeEventListener('bw:dishes:names' as any, onNames);
  }, []);
  function computeSuggestion(q: string) {
    const names = dishNamesRef.current; if (!q) return '';
    const lower = q.toLowerCase();
    const hit = names.find(n => n.toLowerCase().startsWith(lower));
    return hit && hit.length > q.length ? hit : '';
  }
  function onInputChange(v: string) { setInputValue(v); setSuggest(computeSuggestion(v)); fire('bw:keyword:live', v); }
  function onSubmitEnter() { const v = inputValue.trim(); if (!v) return; fire('bw:keyword:search', v); }
  function clearInput() { setInputValue(''); setSuggest(''); fire('bw:keyword:live', ''); }

  async function handleVoice() {
    // App-level permission
    const micPolicy = decidePerm('mic'); // 'allow' | 'deny' | 'ask'
    if (micPolicy === 'deny') {
      addNotice({
        kind: 'system',
        title: 'Microphone disabled',
        body: 'Turn on microphone in Settings to use voice search.',
      });
      return;
    }
    if (micPolicy === 'ask') {
      addNotice({
        kind: 'system',
        title: 'Microphone permission needed',
        body: 'We’ll ask for mic access the next time you try voice search.',
      });
      return;
    }

    // Browser requirements (secure + API support)
    const okProto = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!okProto) {
      addNotice({
        kind: 'system',
        title: 'Voice search unavailable',
        body: 'Use HTTPS (or run locally) to enable the microphone.',
      });
      return;
    }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      addNotice({
        kind: 'system',
        title: 'Voice search not supported',
        body: 'Your browser does not support the Speech Recognition API.',
      });
      return;
    }

    // Try to start recognition
    try {
      const rec = new SR();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      await new Promise<void>((resolve, reject) => {
        rec.onresult = (e: any) => {
          const t = String(e?.results?.[0]?.[0]?.transcript || '').trim();
          if (t) {
            setInputValue(t);
            setSuggest(computeSuggestion(t));
            fire('bw:keyword:live', t);
            // fire both so task tracking is guaranteed
            fire('bw:voice:search', t);
            fire('bw:keyword:search', t);
          }
          resolve();
        };
        rec.onerror = (err: any) => {
          const code = err?.error || err?.message || '';
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            addNotice({
              kind: 'system',
              title: 'Microphone blocked',
              body: 'Browser denied access. Check site permissions in your browser settings.',
            });
          } else if (code !== 'no-speech') {
            addNotice({
              kind: 'system',
              title: 'Voice search error',
              body: String(code),
            });
          }
          reject(code);
        };
        rec.onend = () => resolve();
        rec.start();
      });
    } catch {
      // no-op; notices already shown above where relevant
    }
  }

  /* badges */
  const [badges, setBadges] = useState(getBadgeCounts());
  useEffect(() => {
    const refresh = () => setBadges(getBadgeCounts());
    window.addEventListener('storage', refresh);
    window.addEventListener('bw:badges:update', refresh as any);
    window.addEventListener('bw:task:done', refresh as any);
    window.addEventListener('bw:tokens:gain', refresh as any);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('bw:badges:update', refresh as any);
      window.removeEventListener('bw:task:done', refresh as any);
      window.removeEventListener('bw:tokens:gain', refresh as any);
    };
  }, []);

  /* hamburger */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  /* filters */
  const [priceMax, setPriceMax] = useState<number>(1500);
  const [ratingMin, setRatingMin] = useState<number>(0);
  const [distanceMax, setDistanceMax] = useState<number>(20);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bw.filters'); if (!raw) return;
      const f = JSON.parse(raw) || {};
      if (typeof f.priceMax === 'number') setPriceMax(f.priceMax);
      if (typeof f.ratingMin === 'number') setRatingMin(f.ratingMin);
      if (typeof f.distanceMax === 'number') setDistanceMax(f.distanceMax);
    } catch {}
  }, []);
  function applyFilters() {
    const payload = { priceMax, ratingMin, distanceMax };
    try { localStorage.setItem('bw.filters', JSON.stringify(payload)); } catch {}
    fire('bw:filters:update', payload); setMenuOpen(false);
  }
  function resetFilters() {
    const payload = { priceMax: 1500, ratingMin: 0, distanceMax: 20 };
    setPriceMax(1500); setRatingMin(0); setDistanceMax(20);
    try { localStorage.setItem('bw.filters', JSON.stringify(payload)); } catch {}
    fire('bw:filters:update', payload);
  }

  function logout() {
    try {
      sessionStorage.setItem('bw.logoutReason', 'manual');
      sessionStorage.removeItem('bw.session.phone');
      try { localStorage.removeItem('bw.idle.until'); } catch {}
      try { clearSessionPerms(); } catch {}
      for (const k of ['bw.onboarding','bw.onboarding:v1','bw:onboarding:complete','onboardingComplete','bw_onboarded']) {
        try { localStorage.removeItem(k); } catch {}
        try { sessionStorage.removeItem(k); } catch {}
      }
      try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
      try { window.dispatchEvent(new Event('bw:auth:changed')); } catch {}
      try { window.dispatchEvent(new StorageEvent('storage', { key: 'bw.session.phone', newValue: null as any })); } catch {}
    } finally {
      setMenuOpen(false);
      setTimeout(() => {
        nav('/onboarding', { replace: true });
      }, 0);
    }
  }

  const tokens = Number(localStorage.getItem('bw.tokens') || '0');

  return (
    <header className="w-full mx-auto mt-4">
      <div className="mx-auto w-full max-w-6xl grid grid-cols-[1fr_minmax(300px,640px)_auto] items-center gap-4">
        {/* Left: brand + profile */}
        <div className="text-white">
          <h1 className="text-2xl font-bold leading-tight">BiteWise</h1>
          <p className="text-xs opacity-80 -mt-0.5">Eat! Save! Repeat!</p>
          <p className="text-xs opacity-80 mt-2">Welcome, <span className="font-medium">{name}</span></p>
          {!!(addressLine || addressLabel) && (
            <p className="text-xs opacity-80">
              {addressLabel ? <span className="font-medium">{addressLabel}</span> : null}
              {addressLabel && addressLine ? ' — ' : ''}{addressLine}
            </p>
          )}
        </div>

        {/* Center: search */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 flex items-center px-4 text-black/30 select-none">
            {inputValue && suggest ? (<><span className="opacity-0">{inputValue}</span><span>{suggest.slice(inputValue.length)}</span></>) : null}
          </div>
          <input
            type="search"
            className="w-full rounded-xl border px-4 py-2 pr-20 bg-white/95 text-black shadow relative"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmitEnter(); }}
          />
          {inputValue && (
            <button
              type="button"
              className="absolute right-10 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md bg-black/10 hover:bg-black/15"
              onClick={clearInput}
              aria-label="Clear"
            >
              ×
            </button>
          )}
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-lg border bg-white/90"
            onClick={handleVoice}
            aria-label="Voice search"
          >
            <MicIcon />
          </button>
        </div>

        {/* Right: coin pill + cart + menu */}
        <div className="justify-self-end flex items-center gap-3 relative">
          {/* Coin pill */}
          <button
            onClick={() => nav('/tasks')}
            className="h-9 min-w-[48px] px-2 grid grid-cols-[16px_auto] items-center gap-1 rounded-full border bg-white/90 shadow"
            title="Your Bits"
            aria-label="Your Bits"
          >
            <CoinIcon className="h-4 w-4" />
            <span className="text-xs font-semibold">{tokens}</span>
          </button>

          {/* Cart */}
          <button
            type="button"
            className="relative h-9 w-10 grid place-items-center rounded-xl border bg-white/90 shadow"
            onClick={() => nav('/cart')}
            title="Cart"
            aria-label="Cart"
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute translate-x-3 -translate-y-3 text-xs bg-black text-white rounded-full px-1">
                {count}
              </span>
            )}
          </button>

          {/* Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="h-9 w-10 grid place-items-center rounded-xl border bg-white/90 shadow"
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="Menu"
            >
              <MenuIcon />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w=[320px] max-h-[70vh] overflow-auto rounded-2xl border bg-white/95 shadow p-2 z-50"
              >
                <div className="grid gap-2">
                  <Link to="/notifications" onClick={() => setMenuOpen(false)} className="relative block rounded-xl px-3 py-2 hover:bg-black/5">
                    Notifications
                    {badges.notif > 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-black text-white rounded-full px-2">{badges.notif}</span>}
                  </Link>
                  <Link to="/tasks" onClick={() => setMenuOpen(false)} className="relative block rounded-xl px-3 py-2 hover:bg-black/5">
                    Tasks
                    {badges.tasks > 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-black text-white rounded-full px-2">{badges.tasks}</span>}
                  </Link>
                  <Link to="/leaderboard" onClick={() => setMenuOpen(false)} className="relative block rounded-xl px-3 py-2 hover:bg-black/5">
                    Leaderboard
                    {badges.leaderboard > 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-black" />}
                  </Link>
                  <Link to="/achievements" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-black/5">
                    Achievements
                  </Link>
                  <Link to="/orders/history" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-black/5">
                    Order history
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-black/5">
                    Settings
                  </Link>

                  {/* Filters */}
                  <details className="mt-1 rounded-xl border bg-white/95 open:shadow-sm">
                    <summary className="cursor-pointer px-3 py-2 rounded hover:bg-black/5 select-none">Filter</summary>
                    <div className="p-3 pt-1 grid gap-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Price</p>
                          <p className="text-xs opacity-70">≤ ₹{priceMax}</p>
                        </div>
                        <input type="range" min={50} max={1500} step={10} value={priceMax} className="w-full" onChange={(e) => setPriceMax(Number(e.target.value))} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Rating</p>
                          <p className="text-xs opacity-70">≥ {ratingMin.toFixed(1)}</p>
                        </div>
                        <input type="range" min={0} max={5} step={0.1} value={ratingMin} className="w-full" onChange={(e) => setRatingMin(Number(e.target.value))} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Distance</p>
                          <p className="text-xs opacity-70">≤ {distanceMax} km</p>
                        </div>
                        <input type="range" min={0} max={20} step={1} value={distanceMax} className="w-full" onChange={(e) => setDistanceMax(Number(e.target.value))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <button className="px-3 py-2 rounded border" onClick={resetFilters}>Reset</button>
                        <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={applyFilters}>Done</button>
                      </div>
                    </div>
                  </details>

                  {/* Logout */}
                  <button className="mt-1 w-full px-3 py-2 rounded bg-black text-white" onClick={logout}>
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Yummibot */}
      <button
        type="button"
        aria-label="Yummibot"
        onClick={() => alert('Yummibot: Coming soon!')}
        className="fixed right-4 bottom-4 h-12 w-12 grid place-items-center rounded-full shadow-lg bg-white/95 border z-50"
      >
        <BurgerAvatar className="h-9 w-9" />
      </button>
    </header>
  );
}

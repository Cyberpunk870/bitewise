// src/components/AppHeader.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useCart from '../store/cart'; // ✅ default import (not { useCart })
import { getActiveProfile } from '../lib/profileStore';
import { decidePerm } from '../lib/permPrefs';
import { getBadgeCounts } from '../lib/badgeCounts';
import CoinIcon from './CoinIcon';
import { emit } from '../lib/events';
import { manualLogout } from '../lib/session'; // ✅ NEW: single source of truth
import BitewiseLogo from './BitewiseLogo';
import { searchDishes } from '../lib/fuzzyDish';

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
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

type BotMessage = {
  id: string;
  from: 'bot' | 'user';
  text: string;
  suggestions?: string[];
};

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
  const name = profile?.name?.trim() ? profile.name : 'Guest';
  const addressLine = profile?.addressLine || '';
  const addressLabel = profile?.addressLabel || '';

  /* search */
  const [placeholder, setPlaceholder] = useState('Search dishes...');
  const [inputValue, setInputValue] = useState('');
  const [suggest, setSuggest] = useState('');
  const dishNamesRef = useRef<string[]>([]);

  // rotating placeholder
  useEffect(() => {
    const PROMPTS = [
      'Try “chicken biryani”',
      'Search “best value pizza”',
      'Say “paneer butter masala”',
      'Find “veg momos”',
    ];
    let i = 0;
    const id = setInterval(() => {
      setPlaceholder(PROMPTS[i % PROMPTS.length]);
      i += 1;
    }, 2800);
    return () => clearInterval(id);
  }, []);

  // collect names for suggestions
  useEffect(() => {
    const onNames = (e: Event) => {
      dishNamesRef.current = ((e as CustomEvent).detail as string[]) || [];
    };
    window.addEventListener('bw:dishes:names' as any, onNames);
    return () => window.removeEventListener('bw:dishes:names' as any, onNames);
  }, []);

  function computeSuggestion(q: string) {
    const names = dishNamesRef.current;
    if (!q) return '';
    const lower = q.toLowerCase();
    const hit = names.find((n) => n.toLowerCase().startsWith(lower));
    return hit && hit.length > q.length ? hit : '';
  }
  function onInputChange(v: string) {
    setInputValue(v);
    setSuggest(computeSuggestion(v));
    fire('bw:keyword:live', v);
  }
  function onSubmitEnter() {
    const v = inputValue.trim();
    if (!v) return;
    fire('bw:keyword:search', v);
  }
  function clearInput() {
    setInputValue('');
    setSuggest('');
    fire('bw:keyword:live', '');
  }

  // 🔊 Voice search — respect mic decision; no silent session writes
  async function handleVoice() {
    const micDec = decidePerm('mic'); // 'allow' | 'deny' | 'ask'
    if (micDec !== 'allow') {
      emit('bw:toast', {
        title: 'Microphone permission needed',
        body: 'Enable mic in Settings → Permissions to use voice search.',
      });
      return;
    }
    const okProto =
      location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!okProto) {
      emit('bw:toast', { title: 'Voice search error', body: 'Requires HTTPS (or localhost).' });
      return;
    }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      emit('bw:toast', { title: 'Voice search not supported', body: 'Your browser does not support it.' });
      return;
    }
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
            fire('bw:voice:search', t);
          }
          resolve();
        };
        rec.onerror = (err: any) => reject(err?.error || err?.message);
        rec.onend = () => resolve();
        rec.start();
      });
    } catch (err: any) {
      const msg = String(err || '').toLowerCase();
      const human =
        msg.includes('not-allowed') || msg.includes('permission')
          ? 'Microphone permission blocked. Allow mic in your browser settings.'
          : 'Something went wrong while starting voice search.';
      emit('bw:toast', { title: 'Voice search error', body: human });
    }
  }

  /* badges */
  const [badges, setBadges] = useState(getBadgeCounts());
  useEffect(() => {
    const refresh = () => setBadges(getBadgeCounts());
    window.addEventListener('storage', refresh);
    window.addEventListener('bw:badges:update' as any, refresh as any);
    window.addEventListener('bw:task:done' as any, refresh as any);
    window.addEventListener('bw:tokens:gain' as any, refresh as any);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('bw:badges:update' as any, refresh as any);
      window.removeEventListener('bw:task:done' as any, refresh as any);
      window.removeEventListener('bw:tokens:gain' as any, refresh as any);
    };
  }, []);

  /* hamburger */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
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
      const raw = localStorage.getItem('bw.filters');
      if (!raw) return;
      const f = JSON.parse(raw) || {};
      if (typeof f.priceMax === 'number') setPriceMax(f.priceMax);
      if (typeof f.ratingMin === 'number') setRatingMin(f.ratingMin);
      if (typeof f.distanceMax === 'number') setDistanceMax(f.distanceMax);
    } catch {}
  }, []);
  function applyFilters() {
    const payload = { priceMax, ratingMin, distanceMax };
    try {
      localStorage.setItem('bw.filters', JSON.stringify(payload));
    } catch {}
    fire('bw:filters:update', payload);
    setMenuOpen(false);
  }
  function resetFilters() {
    setPriceMax(1500);
    setRatingMin(0);
    setDistanceMax(20);
    try {
      localStorage.removeItem('bw.filters');
    } catch {}
    setInputValue('');
    setSuggest('');
    try {
      window.dispatchEvent(new CustomEvent('bw:keyword:live', { detail: '' }));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('bw:filters:update', { detail: null }));
    } catch {}
    setMenuOpen(false);
  }

  // 🔐 Logout (manual) → single helper
  async function logout() {
    setMenuOpen(false);
    await manualLogout();
  }

  // ✅ Recheck perms signal (stays local; AppShell also handles)
  const [, setPermTick] = useState(0);
  useEffect(() => {
    const bump = () => setPermTick((t) => t + 1);
    const onRecheck = () => {
      bump();
      try { emit('bw:perm:changed', null); } catch {}
      try {
        window.dispatchEvent(
          new StorageEvent('storage', { key: 'bw.perm.changed', newValue: Date.now().toString() } as any)
        );
      } catch {}
    };
    try {
      if (sessionStorage.getItem('bw.requirePermRecheck') === '1') {
        sessionStorage.removeItem('bw.requirePermRecheck');
        setTimeout(onRecheck, 0);
      }
    } catch {}
    window.addEventListener('bw:perm:recheck' as any, onRecheck as any);
    window.addEventListener('bw:auth:changed' as any, onRecheck as any);
    return () => {
      window.removeEventListener('bw:perm:recheck' as any, onRecheck as any);
      window.removeEventListener('bw:auth:changed' as any, onRecheck as any);
    };
  }, []);

  const tokens = Number(localStorage.getItem('bw.tokens') || '0');

  /* YummiBot assistant */
  const [botOpen, setBotOpen] = useState(false);
  const [botInput, setBotInput] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const [botMessages, setBotMessages] = useState<BotMessage[]>([
    {
      id: 'bot-intro',
      from: 'bot',
      text: "Hey, I'm YummiBot. Ask me for dishes, cuisines, or what's trending!",
    },
  ]);

  const pushBotMessage = (msg: BotMessage) => {
    setBotMessages((prev) => [...prev, msg]);
  };

  const handleBotSend = () => {
    const trimmed = botInput.trim();
    if (!trimmed) return;
    pushBotMessage({ id: `user-${Date.now()}`, from: 'user', text: trimmed });
    setBotInput('');
    setBotTyping(true);

    setTimeout(() => {
      const matches = searchDishes(trimmed, 3);
      if (matches.length) {
        pushBotMessage({
          id: `bot-${Date.now()}`,
          from: 'bot',
          text: `Here’s what I can recommend for “${trimmed}”:`,
          suggestions: matches.map(
            (m) => `${m.dish.name}${m.dish.cuisines?.length ? ` · ${m.dish.cuisines[0]}` : ''}`
          ),
        });
      } else {
        pushBotMessage({
          id: `bot-${Date.now()}`,
          from: 'bot',
          text: `Hmm, I couldn’t find “${trimmed}”. Try a different spelling or ask for a cuisine like “thai curry”.`,
        });
      }
      setBotTyping(false);
    }, 550);
  };

  const handleSuggestionClick = (label: string) => {
    setBotInput(label);
    setSuggest(computeSuggestion(label));
  };

  return (
    <header className="w-full mx-auto mt-4">
      <div className="mx-auto w-full max-w-6xl grid grid-cols-[1fr_minmax(300px,640px)_auto] items-center gap-4">
        {/* Left */}
        <div className="text-white space-y-1">
          <BitewiseLogo />
          <p className="text-xs opacity-80 -mt-1">Eat! Save! Repeat!</p>
          <p className="text-xs opacity-80 mt-2">
            Welcome, <span className="font-medium">{name}</span>
          </p>
          {!!(addressLine || addressLabel) && (
            <p className="text-xs opacity-80">
              {addressLabel ? <span className="font-medium">{addressLabel}</span> : null}
              {addressLabel && addressLine ? ' — ' : ''}
              {addressLine}
            </p>
          )}
        </div>

        {/* Center: search */}
        <div className="relative">
          {/* ghost suggestion */}
          <div className="pointer-events-none absolute inset-0 flex items-center px-4 text-black/30 select-none">
            {inputValue && suggest ? (
              <>
                <span className="opacity-0">{inputValue}</span>
                <span>{suggest.slice(inputValue.length)}</span>
              </>
            ) : null}
          </div>
          <input
            type="search"
            className="w-full rounded-xl border px-4 py-2 pr-20 bg-white/95 text-black shadow relative"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitEnter();
            }}
            aria-label="Search dishes"
          />
          {inputValue && (
            <button
              type="button"
              className="absolute right-10 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md bg-black/10 hover:bg-black/15"
              onClick={clearInput}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-lg border bg-white/90"
            onClick={handleVoice}
            aria-label="Voice search"
            title="Voice search"
          >
            <MicIcon />
          </button>
        </div>

        {/* Right: coin pill + cart + menu */}
        <div className="justify-self-end flex items-center gap-3 relative">
          <button
            onClick={() => {
              emit('bw:open:tasks', null);
              nav('/tasks');
            }}
            className="h-9 min-w-[48px] px-2 grid grid-cols-[16px_auto] items-center gap-1 rounded-full border bg-white/90 shadow"
            title="Your Bites"
            aria-label="Your Bites"
          >
            <CoinIcon className="h-4 w-4" />
            <span className="text-xs font-semibold">{tokens}</span>
          </button>

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
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="Menu"
            >
              <MenuIcon />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-[320px] max-h-[70vh] overflow-auto rounded-2xl border bg-white/95 shadow p-2 z-50"
              >
                <div className="grid gap-2">
                  <Link
                    to="/notifications"
                    onClick={() => setMenuOpen(false)}
                    className="relative block rounded-xl px-3 py-2 hover:bg-black/5"
                  >
                    Notifications
                  </Link>
                  <Link
                    to="/tasks"
                    onClick={() => setMenuOpen(false)}
                    className="relative block rounded-xl px-3 py-2 hover:bg-black/5"
                  >
                    Tasks
                  </Link>
                  <Link
                    to="/leaderboard"
                    onClick={() => setMenuOpen(false)}
                    className="relative block rounded-xl px-3 py-2 hover:bg-black/5"
                  >
                    Leaderboard
                  </Link>
                  <Link
                    to="/achievements"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2 hover:bg-black/5"
                  >
                    Achievements
                  </Link>
                  <Link
                    to="/orders/history"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2 hover:bg-black/5"
                  >
                    Order history
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2 hover:bg-black/5"
                  >
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
                        <input
                          type="range"
                          min={50}
                          max={1500}
                          step={10}
                          value={priceMax}
                          className="w-full"
                          onChange={(e) => setPriceMax(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Rating</p>
                          <p className="text-xs opacity-70">≥ {ratingMin.toFixed(1)}</p>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          step={0.1}
                          value={ratingMin}
                          className="w-full"
                          onChange={(e) => setRatingMin(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Distance</p>
                          <p className="text-xs opacity-70">≤ {distanceMax} km</p>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={20}
                          step={1}
                          value={distanceMax}
                          className="w-full"
                          onChange={(e) => setDistanceMax(Number(e.target.value))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <button className="px-3 py-2 rounded border" onClick={resetFilters}>
                          Reset
                        </button>
                        <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={applyFilters}>
                          Done
                        </button>
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

      {/* Yummibot panel */}
      {botOpen && (
        <div className="fixed right-4 bottom-20 w-80 glass-card border border-white/10 p-4 backdrop-blur-lg z-50 shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BurgerAvatar className="h-6 w-6" />
              YummiBot
            </div>
            <button className="text-xs text-white/60 hover:text-white" onClick={() => setBotOpen(false)}>
              Close
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {botMessages.map((msg) => (
              <div
                key={msg.id}
                className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-line ${
                  msg.from === 'bot'
                    ? 'bg-white/10 text-white self-start'
                    : 'bg-white text-black self-end'
                }`}
              >
                {msg.text}
                {msg.suggestions && (
                  <ul className="mt-2 space-y-1 text-xs text-white/80">
                    {msg.suggestions.map((line, idx) => (
                      <li key={`${msg.id}-s-${idx}`}>
                        <button
                          className="underline decoration-dotted hover:text-white"
                          onClick={() => handleSuggestionClick(line)}
                        >
                          {line}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {botTyping && (
              <div className="px-3 py-2 rounded-2xl bg-white/10 text-xs text-white/80 self-start">
                YummiBot is thinking…
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={botInput}
              onChange={(e) => setBotInput(e.target.value)}
              className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
              placeholder="Ask for dishes or cuisines"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBotSend();
              }}
            />
            <button
              className="rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-black"
              onClick={handleBotSend}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Floating Yummibot */}
      <button
        type="button"
        aria-label="Yummibot"
        onClick={() => setBotOpen((v) => !v)}
        className="fixed right-4 bottom-4 h-14 w-14 grid place-items-center rounded-full shadow-2xl border border-white/30 bg-gradient-to-br from-white via-pink-50 to-orange-100 text-black z-40"
      >
        <BurgerAvatar className="h-9 w-9" />
      </button>
    </header>
  );
}

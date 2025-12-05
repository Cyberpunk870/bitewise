// src/components/AppHeader.tsx
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useCart from '../store/cart'; // ✅ default import (not { useCart })
import { getActiveProfile } from '../lib/profileStore';
import { allowForThisSession, decidePerm } from '../lib/permPrefs';
import { getBadgeCounts } from '../lib/badgeCounts';
import CoinIcon from './CoinIcon';
import { emit } from '../lib/events';
import { manualLogout } from '../lib/session'; // ✅ NEW: single source of truth
import BitewiseLogo from './BitewiseLogo';
import type { FuzzyDishMatch } from '../lib/fuzzyDish';
import type { BotMessage as PanelMessage } from './YummiBotPanel';
import { setActiveProfileFields } from '../lib/profileStore';
const HeaderActions = React.lazy(() => import('./HeaderActions'));

/* icons */
function MicIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" role="img" aria-label="Voice search" {...props}>
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
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" role="img" aria-label="Menu" {...props}>
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
  pills?: string[];
};

const BotShell = React.lazy(() => import('./YummiBotPanel'));

export default function AppHeader() {
  const nav = useNavigate();
  const { count } = useCart();
  const fuzzyRef = useRef<((query: string, limit?: number) => FuzzyDishMatch[]) | null>(null);
  const [botReady, setBotReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let idleHandle: number | null = null;
    const load = () => {
      import('../lib/fuzzyDish')
        .then((mod) => {
          if (mounted) fuzzyRef.current = mod.searchDishes;
        })
        .catch(() => {});
    };
    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idleHandle = (window as any).requestIdleCallback(
          () => {
            idleHandle = null;
            load();
          },
          { timeout: 2000 }
        );
      } else {
        idleHandle = Number(setTimeout(() => {
          idleHandle = null;
          load();
        }, 1200));
      }
    };
    schedule();
    return () => {
      mounted = false;
      if (idleHandle != null) {
        if ('cancelIdleCallback' in window && typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle);
        }
      }
    };
  }, []);

  useEffect(() => {
    let handle: number | null = null;
    const markReady = () => setBotReady(true);
    if ('requestIdleCallback' in window) {
      handle = (window as any).requestIdleCallback(
        () => {
          handle = null;
          markReady();
        },
        { timeout: 2500 }
      );
    } else {
      handle = Number(setTimeout(() => {
        handle = null;
        markReady();
      }, 1800));
    }
    return () => {
      if (handle != null) {
        if ('cancelIdleCallback' in window && typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(handle);
        } else {
          clearTimeout(handle);
        }
      }
    };
  }, []);


  /* profile */
  const [profile, setProfile] = useState(() => getActiveProfile());
  const [activeAddr, setActiveAddr] = useState<{ label: string; line: string; lat?: number; lng?: number } | null>(() => {
    try {
      const raw = localStorage.getItem('bw.addresses');
      if (!raw) return null;
      const list = JSON.parse(raw) || [];
      if (!Array.isArray(list) || !list.length) return null;
      const pick = list.find((a: any) => a?.active) || list[0];
      if (!pick) return null;
      return {
        label: pick.label || '',
        line: pick.addressLine || '',
        lat: typeof pick.lat === 'number' ? pick.lat : undefined,
        lng: typeof pick.lng === 'number' ? pick.lng : undefined,
      };
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const refresh = () => setProfile(getActiveProfile());
    const onAddresses = () => {
      try {
        const raw = localStorage.getItem('bw.addresses');
        if (!raw) return;
        const list = JSON.parse(raw) || [];
        if (!Array.isArray(list) || !list.length) return;
        const pick = list.find((a: any) => a?.active) || list[0];
        if (!pick) return;
        const next = {
          label: pick.label || '',
          line: pick.addressLine || '',
          lat: typeof pick.lat === 'number' ? pick.lat : undefined,
          lng: typeof pick.lng === 'number' ? pick.lng : undefined,
        };
        setActiveAddr(next);
        // keep profile in sync so other screens see the same active address
        setActiveProfileFields({
          addressLabel: next.label || profile?.addressLabel,
          addressLine: next.line || profile?.addressLine,
          lat: typeof next.lat === 'number' ? next.lat : profile?.lat,
          lng: typeof next.lng === 'number' ? next.lng : profile?.lng,
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('bw:profile:update' as any, refresh as any);
    window.addEventListener('storage', onAddresses);
    window.addEventListener('bw:addresses:update' as any, onAddresses as any);
    onAddresses();
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('bw:profile:update' as any, refresh as any);
      window.removeEventListener('storage', onAddresses);
      window.removeEventListener('bw:addresses:update' as any, onAddresses as any);
    };
  }, []);
  const name = profile?.name?.trim() ? profile.name : 'Guest';
  const addressLine = activeAddr?.line || profile?.addressLine || '';
  const addressLabel = activeAddr?.label || profile?.addressLabel || '';
  const addressTextId = 'nav-address';

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

  // Ensure mic permission and sync preference when user explicitly tries voice
async function ensureMicAccess(): Promise<boolean> {
  // If user explicitly set mic to "allow" in Settings, trust that and avoid re-prompting.
  const micPref = decidePerm('mic');
  if (micPref === 'allow') {
    allowForThisSession('mic');
    emit('bw:perm:mic:enabled', null as any);
    return true;
  }

  const secure =
    location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure || !navigator.mediaDevices?.getUserMedia) {
    emit('bw:toast', {
      title: 'Voice search blocked',
        body: 'Microphone works only on HTTPS (or localhost).',
      });
      return false;
    }

    try {
      if (navigator.permissions?.query) {
        const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (res.state === 'granted') {
          allowForThisSession('mic');
          emit('bw:perm:changed', null);
          return true;
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      allowForThisSession('mic');
      emit('bw:perm:changed', null);
      return true;
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      const human =
        msg.includes('denied') || msg.includes('notallowed')
          ? 'Microphone permission is blocked. Enable it in your browser and try again.'
          : 'Could not start the microphone. Check your browser permission.';
      emit('bw:toast', { title: 'Microphone needed', body: human });
      return false;
    }
  }

  // 🔊 Voice search — respect mic decision; no silent session writes
  async function handleVoice() {
    const micDec = decidePerm('mic'); // 'allow' | 'deny' | 'ask'
    if (micDec === 'deny') {
      emit('bw:toast', {
        title: 'Microphone permission needed',
        body: 'Enable mic in Settings → Permissions to use voice search.',
      });
      return;
    }
    if (micDec !== 'allow') {
      const ok = await ensureMicAccess();
      if (!ok) return;
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
  const [botMessages, setBotMessages] = useState<PanelMessage[]>([
    {
      id: 'bot-intro',
      from: 'bot',
      text: "Hey, I'm YummiBot. Ask me for dishes, cuisines, or what's trending!",
      pills: ['🔥 Trending', '⭐ Favorites', '🍽️ Frequently ordered', '🥗 Salads', '🍕 Pizza', '🧆 Biryani'],
    },
  ]);

  useEffect(() => {
    const open = () => setBotOpen(true);
    window.addEventListener('bw:yummibot:open' as any, open as any);
    return () => {
      window.removeEventListener('bw:yummibot:open' as any, open as any);
    };
  }, []);

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
      const fn = fuzzyRef.current;
      const matches = fn ? fn(trimmed, 3) : [];
      if (matches.length) {
        pushBotMessage({
          id: `bot-${Date.now()}`,
          from: 'bot',
          text: `Here’s what I can recommend for “${trimmed}”:`,
          suggestions: matches.map((m) => {
            const cuisine = m.dish.cuisines?.[0] ? ` · ${m.dish.cuisines[0]}` : '';
            const reason = m.reason ? ` — ${m.reason}` : '';
            return `${m.dish.name}${cuisine}${reason}`;
          }),
          pills: ['🔥 Trending', '⭐ Favorites', '🍽️ Frequently ordered'],
        });
      } else {
        pushBotMessage({
          id: `bot-${Date.now()}`,
          from: 'bot',
          text: `Hmm, I couldn’t find “${trimmed}”. Try a different spelling or ask for a cuisine like “thai curry”.`,
          pills: ['🔥 Trending', '⭐ Favorites', '🍽️ Frequently ordered', '🥘 North Indian', '🍝 Pasta'],
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
    <header className="w-full mx-auto mt-4 px-4">
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-6 gap-3">
          {/* Left */}
          <div className="text-white space-y-1 flex-1">
            <BitewiseLogo showTagline showMark={false} />
            <p className="text-xs text-white/70 mt-2">
              Welcome, <span className="font-medium">{name}</span>
            </p>
            {!!(addressLine || addressLabel) && (
              <div className="text-xs text-white/60 leading-relaxed max-w-sm break-words" id={addressTextId}>
                {addressLabel ? <div className="font-medium">{addressLabel}</div> : null}
                {addressLine ? <div>{addressLine}</div> : null}
              </div>
            )}
          </div>

          {/* Search + Actions row */}
          <div className="flex-1 w-full flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-0 flex items-center px-4 text-white/25 select-none">
                  {inputValue && suggest ? (
                    <>
                      <span className="opacity-0">{inputValue}</span>
                      <span>{suggest.slice(inputValue.length)}</span>
                    </>
                  ) : null}
                </div>
                <input
                  id="home-search-input"
                  type="text"
                  className="w-full rounded-xl border border-white/15 px-4 py-2 pr-20 bg-white/5 text-white shadow-[0_15px_45px_rgba(4,9,20,0.35)] backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/15 placeholder:text-white/40"
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
                    className="absolute right-10 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md bg-white/80 text-slate-900 hover:bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
                    onClick={clearInput}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-lg border border-white/40 bg-white/90 text-slate-900 hover:bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
                  onClick={handleVoice}
                  aria-label="Voice search"
                  title="Voice search"
                  id="nav-mic"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleVoice();
                    }
                  }}
                >
                  <MicIcon />
                </button>
              </div>

              <Suspense
                fallback={
                  <div className="flex items-center gap-3 relative opacity-50">
                    <div className="h-10 w-24 rounded-full bg-white/5" />
                  </div>
                }
              >
                <HeaderActions
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  priceMax={priceMax}
                  ratingMin={ratingMin}
                  distanceMax={distanceMax}
                  setPriceMax={setPriceMax}
                  setRatingMin={setRatingMin}
                  setDistanceMax={setDistanceMax}
                  applyFilters={applyFilters}
                  resetFilters={resetFilters}
                  logout={logout}
                  tokens={tokens}
                  cartId="nav-cart"
                  menuId="nav-menu"
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {botOpen && botReady && (
        <Suspense fallback={null}>
          <BotShell
            onClose={() => setBotOpen(false)}
            messages={botMessages}
            typing={botTyping}
            input={botInput}
            onInput={setBotInput}
            onSend={handleBotSend}
            onSuggestion={handleSuggestionClick}
          />
        </Suspense>
      )}

      {/* Floating Yummibot */}
      {botReady && (
        <button
          type="button"
          aria-label="Yummibot"
          onClick={() => setBotOpen((v) => !v)}
          className="fixed right-4 bottom-4 h-14 w-14 grid place-items-center rounded-full shadow-2xl border border-white/20 bg-white/10 text-white z-40 backdrop-blur"
          id="yummibot-trigger"
        >
          <BurgerAvatar className="h-9 w-9" />
        </button>
      )}
    </header>
  );
}

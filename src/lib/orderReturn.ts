// src/lib/orderReturn.ts
import { emit } from './events';
import { sendLocalNotification } from './notify';
import { getAuth } from 'firebase/auth';
import {
  addCoins as apiAddCoins,
  markOutbound as apiMarkOutbound,
  markCompletion as apiMarkCompletion,
} from './api';
import { setTokens } from './tokens'; // <- existing setter from tokens.ts
import { track } from './track';
import { addSavings } from '../store/savings';
import { logError } from './logger';

export type OutboundCtx = {
  id?: string;               // backend id from /api/orders/outbound
  ts: number;
  restaurantId: string;
  restaurantName: string;
  platform: 'swiggy' | 'zomato' | string;
  total: number;
  otherTotal?: number;
  delta?: number;            // otherTotal - total (positive means we saved)
  tokenReward: number;       // Bits to award on confirm
  deepLink: string;
};

const KEY = 'bw.outbound.order';

function readStored(): OutboundCtx | null {
  const parse = (raw: string | null) => {
    if (!raw) return null;
    try { return JSON.parse(raw) as OutboundCtx; } catch { return null; }
  };
  const ls = parse(localStorage?.getItem?.(KEY) || null);
  if (ls) return ls;
  return parse(sessionStorage?.getItem?.(KEY) || null);
}

function writeStored(ctx: OutboundCtx) {
  try { localStorage.setItem(KEY, JSON.stringify(ctx)); } catch {}
  try { sessionStorage.setItem(KEY, JSON.stringify(ctx)); } catch {}
}

export function getPendingReturn(): OutboundCtx | null {
  try {
    const ctx = readStored();
    if (!ctx) return null;
    // expire after 2h
    if (Date.now() - ctx.ts > 2 * 60 * 60 * 1000) {
      clearPendingReturn();
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

export function clearPendingReturn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** 🔔 Fire a hint when user returns to the tab and we still have a pending order. */
export function initReturnListener() {
  const onVisible = () => {
    if (document.visibilityState === 'visible' && getPendingReturn()) {
      emit('bw:return:possible', null);
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  setTimeout(onVisible, 0); // also once on load
  return () => document.removeEventListener('visibilitychange', onVisible);
}

/**
 * Start an outbound order:
 * 1. stash locally so ReturnBanner can show even if offline
 * 2. ping backend /api/orders/outbound so we get a server-side event id
 */
export async function startOutbound(ctx: OutboundCtx): Promise<void> {
  // (1) keep local
  writeStored(ctx);

  // (2) ask backend to create outbound record
  try {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      // user not signed in => we can't attribute to Firestore yet.
      return;
    }

    // NEW SHAPE:
    // markOutbound(payload) no longer needs user_id; backend injects from token.
    // We'll send pricing + context. We DO NOT care about coins here.
    const outboundRes = await apiMarkOutbound({
      platform: ctx.platform,
      partner: ctx.platform, // for now keep partner/platform compatibility
      restaurant: ctx.restaurantName,
      dish_name: ctx.restaurantName,
      total: ctx.total,
      otherTotal: ctx.otherTotal ?? ctx.total,
      delta: ctx.delta ?? 0,
    });

    if (outboundRes?.id) {
      const withId: OutboundCtx = { ...ctx, id: String(outboundRes.id) };
      writeStored(withId);
      track('compare_outbound', {
        platform: ctx.platform,
        restaurant: ctx.restaurantName,
        delta: ctx.delta ?? 0,
      });
    }
  } catch (err) {
    logError('startOutbound failed', { err: String(err) }, { toast: true });
  }
}

/**
 * User taps "I placed it" in ReturnBanner.
 *
 * We do 4 things:
 *  1. update local token balance immediately (optimistic)
 *  2. call /api/users/coins/add with (amount, reason)
 *  3. call /api/orders/complete so backend:
 *      - finalizes the order event
 *      - bumps totals / leaderboard / achievements
 *      - rate-limits repeat completions
 *  4. toast + local notification
 *
 * Returns summary for debugging.
 */
export async function confirmOrderPlaced(): Promise<{
  saved: number;
  tokensAwarded: number;
  ctx: OutboundCtx | null;
}> {
  const ctx = getPendingReturn();

  if (!ctx) {
    return { saved: 0, tokensAwarded: 0, ctx: null };
  }

  // compute savings we *think* they got
  let saved = 0;
  if (ctx) {
    const raw = ctx.delta ?? 0;
    saved = Math.max(0, Math.round(raw));
  }

  // --- 1. optimistic local tokens ---
  let tokens = 0;
  try {
    tokens = Number(localStorage.getItem('bw.tokens') || '0');
  } catch {}
  const award = ctx?.tokenReward ?? 0;
  const newBal = tokens + award;

  setTokens(newBal);
  try {
    localStorage.setItem('bw.tokens', String(newBal));
  } catch {}

  emit('bw:tokens:gain', { amount: award, balance: newBal });
  emit('bw:reward', { amount: award, balance: newBal });

  // --- 2 & 3. server sync (fire-and-forget style, but awaited where it matters) ---
  try {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;

    // 2) award coins server-side
    //    NEW SIGNATURE: addCoins(amount, reason)
    if (uid && award > 0) {
      // we *don't* await this strictly; coins failing shouldn't block completion
      apiAddCoins(award, 'order:return').catch(() => {});
    }

    // 3) ensure we have an outbound id; if missing, recreate it now
    let outboundId = ctx?.id;
    if (!outboundId && ctx) {
      try {
        const res = await apiMarkOutbound({
          platform: ctx.platform,
          partner: ctx.platform,
          restaurant: ctx.restaurantName,
          dish_name: ctx.restaurantName,
          total: ctx.total,
          otherTotal: ctx.otherTotal ?? ctx.total,
          delta: ctx.delta ?? 0,
        });
        if (res?.id) {
          outboundId = String(res.id);
          writeStored({ ...ctx, id: outboundId });
        }
      } catch (err) {
        logError('apiMarkOutbound (retry) failed', { err: String(err) });
      }
    }

    if (outboundId) {
      await apiMarkCompletion(outboundId, saved);
      emit('bw:orders:refresh', null);
      track('order_complete', {
        platform: ctx.platform,
        restaurant: ctx.restaurantName,
        saved,
        award,
      });
    }
  } catch (err) {
    logError('confirmOrderPlaced sync failed', { err: String(err) }, { toast: true });
  }

  // --- 4. UX feedback ---
  if (saved > 0) {
    try {
      addSavings(saved);
    } catch {
      /* ignore local persistence issues */
    }
  }
  if (saved > 0) {
    emit('bw:toast', {
      title: 'Nice savings!',
      body: `You saved ~₹${saved}`,
    });
    sendLocalNotification(
      'Order saved!',
      `You saved about ₹${saved}. +${award} Bits`
    );
  } else {
    emit('bw:toast', {
      title: 'Order recorded',
      body: `+${award} Bits added`,
    });
    sendLocalNotification(
      'Order recorded',
      `+${award} Bits added to your balance`
    );
  }

  // clear banner state
  clearPendingReturn();

  return { saved, tokensAwarded: award, ctx };
}

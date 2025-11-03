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

export function getPendingReturn(): OutboundCtx | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw) as OutboundCtx;
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
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {}

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
      try {
        sessionStorage.setItem(KEY, JSON.stringify(withId));
      } catch {}
    }
  } catch {
    // swallow: local pending flow will still work
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

    // 3) mark completion so backend can roll up savings, leaderboard, etc.
    if (ctx?.id) {
      await apiMarkCompletion(ctx.id, saved);
    }
  } catch {
    // swallow; optimistic local state already updated
  }

  // --- 4. UX feedback ---
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
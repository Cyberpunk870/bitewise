// src/screens/legal/RewardsPolicy.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function RewardsPolicy() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#120b26] to-[#1c123d] text-white px-4 pb-16">
      <div className="max-w-4xl mx-auto pt-10 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="px-3 py-1.5 rounded-xl border border-white/20 text-white/80 hover:text-white hover:border-white/40"
          >
            ← Back
          </Link>
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-white/60">Policies</div>
            <h1 className="text-3xl font-extrabold">Rewards & Notifications</h1>
            <p className="text-white/75">How we handle push, passkeys, referrals, and BiteCoins.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h2 className="text-xl font-semibold">Push Notifications</h2>
          <ul className="list-disc list-inside text-white/80 space-y-1 text-sm">
            <li>We send order updates, promos, price drops, and feature announcements.</li>
            <li>You can opt out anytime via browser/device settings or the in-app toggle.</li>
            <li>We store a device token tied to your account; tokens are pruned if inactive.</li>
            <li>Delivery is powered by Firebase Cloud Messaging (Google).</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h2 className="text-xl font-semibold">WebAuthn Passkeys</h2>
          <ul className="list-disc list-inside text-white/80 space-y-1 text-sm">
            <li>Passkeys stay on your device; we only store the public key and metadata.</li>
            <li>Clearing browser/device may require re-registering a passkey.</li>
            <li>Device PIN/biometric prompts are handled by your OS; we never receive biometrics.</li>
            <li>OTP remains available as a fallback login method.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h2 className="text-xl font-semibold">Referrals & BiteCoins</h2>
          <ul className="list-disc list-inside text-white/80 space-y-1 text-sm">
            <li>Rewards (current): referrer +50 coins, referee +25 coins. Max 3 redemptions per code.</li>
            <li>Caps: up to 150 coins/day and 600 coins/month per account. Coins beyond caps are not awarded.</li>
            <li>Coins are promotional credits, non-cash, non-transferable, and may expire after 6 months.</li>
            <li>Coins may be reversed for cancellations/refunds or suspected abuse.</li>
            <li>One redemption per user/account/device; self-referrals are disallowed.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h2 className="text-xl font-semibold">Redemption & Offers</h2>
          <ul className="list-disc list-inside text-white/80 space-y-1 text-sm">
            <li>Coins can be applied only to eligible offers/brands; may require a minimum cart value.</li>
            <li>Promos and seasonal slots are limited-time and subject to change without notice.</li>
            <li>We may track aggregate clicks/impressions on offers to improve relevance; no PII is stored in that tracking.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h2 className="text-xl font-semibold">Data & Privacy</h2>
          <ul className="list-disc list-inside text-white/80 space-y-1 text-sm">
            <li>Device tokens, referral events, passkey public keys, and reward logs are processed under our Privacy Policy.</li>
            <li>
              See <Link className="underline" to="/legal/privacy">Privacy Policy</Link> and{' '}
              <Link className="underline" to="/legal/terms">Terms of Service</Link> for full details.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

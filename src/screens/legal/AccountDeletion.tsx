import React from 'react';
import { Link } from 'react-router-dom';

const LAST_UPDATED = '06 February 2025';

export default function AccountDeletion() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#030712] to-[#0f172a] text-white px-4 py-10">
      <article className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Account deletion</p>
          <h1 className="text-3xl font-semibold">Delete your BiteWise account</h1>
          <p className="text-sm text-white/60">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="text-sm leading-relaxed text-white/80 space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-white">How to request deletion</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Sign in to BiteWise, go to{' '}
              <Link to="/settings" className="text-emerald-300 underline">
                Settings
              </Link>{' '}
              and tap <span className="font-semibold text-white">Delete account</span>.
            </li>
            <li>Confirm the request using the email tied to your BiteWise account.</li>
            <li>We sign you out and permanently delete your profile data within 7 days.</li>
          </ol>
          <p className="text-white/70">
            You can also email us directly if you cannot access the app.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:kg11041963@gmail.com?subject=Account%20Deletion%20Request"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400 transition"
            >
              Email deletion request
            </a>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 transition"
            >
              Open Settings
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What we delete</h2>
          <ul className="list-disc pl-5 text-sm text-white/80 space-y-2">
            <li>Profile data: name, phone number, addresses, and saved preferences.</li>
            <li>Authentication artifacts: passkey metadata and device tokens.</li>
            <li>Activity history: missions, coins, achievements, and order shortcuts stored by BiteWise.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What we may retain temporarily</h2>
          <p className="text-sm text-white/80">
            We may keep limited records needed to meet legal, fraud-prevention, or accounting
            requirements. These records are delinked from your profile and removed when no longer required.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Need help?</h2>
          <p className="text-sm text-white/80">
            If you run into issues, contact{' '}
            <a href="mailto:kg11041963@gmail.com" className="text-emerald-300 underline">
              kg11041963@gmail.com
            </a>{' '}
            from your registered email and include your phone number. We aim to confirm deletion within 24 hours and complete it within 7 days.
          </p>
        </section>
      </article>
    </main>
  );
}

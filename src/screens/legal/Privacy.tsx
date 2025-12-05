import React from 'react';
import { Link } from 'react-router-dom';

const LAST_UPDATED = '19 November 2025';

export default function Privacy() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#030712] to-[#0f172a] text-white px-4 py-10">
      <article className="max-w-4xl mx-auto space-y-8">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Privacy Policy</p>
          <h1 className="text-3xl font-semibold mt-2">How BiteWise Handles Your Data</h1>
          <p className="text-sm text-white/60 mt-2">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="text-sm leading-relaxed text-white/80 space-y-4">
          <p>
            This Privacy Policy explains what personal information BiteWise collects, how we use it,
            and the choices you have. It applies to the BiteWise mobile/web application, APIs, and
            any communications or services connected to it.
          </p>
          <p>
            By using BiteWise, you consent to the practices described here. If you disagree, please
            discontinue use and contact us to delete your data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Data We Collect</h2>
          <ul className="list-disc pl-5 text-sm text-white/80 space-y-2">
            <li>
              <strong>Account data:</strong> phone number, name, saved addresses, and passkey
              metadata provided during onboarding.
            </li>
            <li>
              <strong>Usage data:</strong> missions completed, coins earned, leaderboards, compare
              actions, push notification preferences, in-app events, and device tokens.
            </li>
            <li>
              <strong>Device &amp; log data:</strong> anonymized device info, IP address, browser
              type, timestamps, and diagnostic logs.
            </li>
            <li>
              <strong>Location data:</strong> only when you grant permission for address detection,
              geolocation, or “Use my location” features.
            </li>
            <li>
              <strong>Communications:</strong> feedback emails, support requests, and opt-in
              marketing preferences.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. How We Use Data</h2>
          <ul className="list-disc pl-5 text-sm text-white/80 space-y-2">
            <li>Authenticate you via OTP/passkey and keep your session secure.</li>
            <li>Personalize recommendations, price comparisons, and missions.</li>
            <li>Maintain coins, achievements, and order history across devices.</li>
            <li>Send transactional notifications (OTP, mission reminders, push opt-ins).</li>
            <li>Troubleshoot bugs, monitor performance, and detect abuse or fraud.</li>
            <li>Comply with legal obligations, tax/accounting requirements, or law enforcement requests.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Sharing &amp; Disclosure</h2>
          <p className="text-sm text-white/80">
            We do not sell your personal information. We may share limited data with:
          </p>
          <ul className="list-disc pl-5 text-sm text-white/80 space-y-2">
            <li>
              <strong>Service providers</strong> who host infrastructure, deliver notifications, or
              support analytics (e.g., Firebase, Google Cloud, Vercel). They only access what is
              needed to perform contracted services.
            </li>
            <li>
              <strong>Delivery partners</strong> when you tap external order links. Once you leave
              BiteWise their privacy policies apply.
            </li>
            <li>
              <strong>Legal authorities</strong> when required by applicable law, court order, or to
              protect BiteWise, our users, or the public.
            </li>
            <li>
              <strong>Business transfers</strong> if BiteWise undergoes a merger, acquisition, or asset sale.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Cookies &amp; Tracking</h2>
          <p className="text-sm text-white/80">
            BiteWise relies primarily on session storage, local storage, and Firebase session
            cookies to keep you signed in. We do not run third-party advertising trackers. You can
            clear cookies/storage from your browser or use the in-app reset route to remove locally
            stored data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Data Retention</h2>
          <p className="text-sm text-white/80">
            We keep account data while your BiteWise profile is active. If you delete your account or
            remain inactive for an extended period, we archive or anonymize your data unless we must
            retain it for legal, compliance, or fraud-prevention reasons. Cached mission progress is
            pruned regularly to keep storage light.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Your Choices &amp; Rights</h2>
          <ul className="list-disc pl-5 text-sm text-white/80 space-y-2">
            <li>Review or update profile information from Settings &gt; Profile.</li>
            <li>Revoke permissions (location, notifications, mic) anytime via device settings.</li>
            <li>Opt out of push/email marketing using unsubscribe controls or by emailing support.</li>
            <li>
              Request a copy, correction, or deletion of your data by contacting{' '}
              <a href="mailto:privacy@bitewise.app" className="text-emerald-300 underline">
                privacy@bitewise.app
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Security</h2>
          <p className="text-sm text-white/80">
            BiteWise uses TLS encryption, Firebase Authentication, and restricted service accounts
            to protect data. No system is perfectly secure, so please notify us immediately if you
            suspect unauthorized access. We also recommend enabling device-level security (screen
            lock, biometrics) when using BiteWise.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Children</h2>
          <p className="text-sm text-white/80">
            BiteWise is not directed to individuals under 18, and we do not knowingly collect
            children&apos;s data. If you believe a minor has provided personal information, contact us
            and we will delete it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. International Transfers</h2>
          <p className="text-sm text-white/80">
            BiteWise stores data in India and/or other jurisdictions via our cloud providers. By
            using the Service you consent to this cross-border processing and acknowledge that local
            laws may differ from your jurisdiction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Changes to this Policy</h2>
          <p className="text-sm text-white/80">
            We will update this Privacy Policy when we introduce new features, integrate additional
            partners, or when required by law. Material updates will be announced in-app or via
            email, and the &quot;Last updated&quot; date will change. Continued use after an update
            constitutes acceptance of the revised policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Contact</h2>
          <p className="text-sm text-white/80">
            For privacy questions, reach us at{' '}
            <a href="mailto:privacy@bitewise.app" className="text-emerald-300 underline">
              privacy@bitewise.app
            </a>
            . For other legal matters see our{' '}
            <Link to="/legal/terms" className="text-emerald-300 underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

const LAST_UPDATED = '19 November 2025';

export default function Terms() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#04010a] to-[#0f172a] text-white px-4 py-10">
      <article className="max-w-4xl mx-auto space-y-8">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Terms of Service</p>
          <h1 className="text-3xl font-semibold mt-2">BiteWise Terms &amp; Conditions</h1>
          <p className="text-sm text-white/60 mt-2">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-white/80">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the BiteWise
            application, website, APIs, and related communications (collectively, the
            &quot;Service&quot;). By creating an account, completing onboarding, or using any
            portion of the Service you agree to these Terms. If you do not agree, do not access or
            use BiteWise.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Eligibility &amp; Accounts</h2>
          <p className="text-sm text-white/80">
            You must be at least 18 years old (or the age of majority in your jurisdiction) and
            capable of entering into a binding agreement. You are responsible for keeping your phone
            number, passkey, and any other credentials secure. You agree to provide accurate
            information and to promptly update it if it changes. BiteWise may suspend or terminate
            your account if we detect misuse, fraud, or a breach of these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Service Description</h2>
          <p className="text-sm text-white/80">
            BiteWise aggregates restaurant discovery, price comparisons, missions/loyalty programs,
            and push notifications to help you make food-ordering decisions. We do not cook, deliver,
            or guarantee availability/pricing from partner platforms such as Swiggy or Zomato.
            External links and offers are provided for convenience only; each third-party platform&apos;s
            own terms govern the final transaction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. User Responsibilities</h2>
          <ul className="list-disc pl-5 text-sm text-white/80 space-y-2">
            <li>Comply with all applicable laws, including those governing telemarketing/OTP usage.</li>
            <li>Use BiteWise only for personal, non-commercial purposes unless explicitly approved.</li>
            <li>
              Refrain from reverse engineering, scraping, or attempting to bypass security controls.
            </li>
            <li>
              Do not submit inaccurate pricing, fake missions, or misleading data intended to game
              leaderboards or rewards.
            </li>
            <li>
              Respect other users and BiteWise staff; harassment or abuse results in immediate
              suspension.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Rewards, Coins &amp; Missions</h2>
          <p className="text-sm text-white/80">
            Missions, coins, or any promotional rewards offered within BiteWise have no cash value.
            We reserve the right to modify, pause, or cancel reward programs at any time without
            liability. Fraudulent activity (e.g., simulated orders, duplicate accounts) will void
            accumulated coins and may lead to a ban.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Third-Party Services</h2>
          <p className="text-sm text-white/80">
            BiteWise uses third-party services such as Firebase, Google Maps, and food-delivery
            partners. We do not control or guarantee their availability. When you follow a link or
            place an order through a partner, their terms and privacy policies apply. We are not
            responsible for delays, cancellations, pricing discrepancies, or issues caused by
            third-party systems.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Intellectual Property</h2>
          <p className="text-sm text-white/80">
            BiteWise, the BiteWise logo, and associated graphics/content are owned by BiteWise Labs.
            You may not reproduce or reuse them without written consent. You can submit feedback or
            ideas, but we may use them without restriction or compensation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Disclaimers &amp; Limitation of Liability</h2>
          <p className="text-sm text-white/80">
            BiteWise is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
            warranties of any kind. To the fullest extent permitted by law, BiteWise disclaims all
            implied warranties (merchantability, fitness, non-infringement). BiteWise is not liable
            for indirect, incidental, consequential, or punitive damages, or for loss of profits,
            data, goodwill, or other intangible losses arising from your use of the Service. Our total
            liability will not exceed the greater of ₹1,000 or the amounts you paid (if any) in the
            past six months.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Indemnity</h2>
          <p className="text-sm text-white/80">
            You agree to indemnify and hold BiteWise, its founders, employees, and partners harmless
            from any claims, damages, or expenses arising from your use of the Service, your breach of
            these Terms, or your violation of any law or third-party right.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Suspension &amp; Termination</h2>
          <p className="text-sm text-white/80">
            We may suspend or terminate access at our discretion, including for inactivity,
            suspected fraud, security threats, or violations of these Terms. You may also close your
            account at any time by contacting{' '}
            <a href="mailto:legal@bitewise.app" className="text-emerald-300 underline">
              legal@bitewise.app
            </a>
            . Some provisions (ownership, disclaimers, limitations) survive termination.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Governing Law &amp; Disputes</h2>
          <p className="text-sm text-white/80">
            These Terms are governed by the laws of India, with the courts of New Delhi having
            exclusive jurisdiction. If any provision is deemed unenforceable, the remaining sections
            remain in effect.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Changes</h2>
          <p className="text-sm text-white/80">
            We may update these Terms to reflect product, legal, or regulatory changes. Updated
            versions will be posted on this page with a new &quot;Last updated&quot; date. Material
            changes will be highlighted in-app or via email. Your continued use constitutes
            acceptance of the revised Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">12. Contact</h2>
          <p className="text-sm text-white/80">
            Questions about these Terms? Email{' '}
            <a href="mailto:legal@bitewise.app" className="text-emerald-300 underline">
              legal@bitewise.app
            </a>{' '}
            or view our{' '}
            <Link to="/legal/privacy" className="text-emerald-300 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}

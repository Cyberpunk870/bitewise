// src/components/AppFooter.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function AppFooter() {
  return (
    <footer className="mt-8 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <Link className="hover:text-white underline underline-offset-4" to="/legal/privacy">
          Privacy
        </Link>
        <Link className="hover:text-white underline underline-offset-4" to="/legal/terms">
          Terms
        </Link>
        <Link className="hover:text-white underline underline-offset-4" to="/legal/rewards">
          Rewards policy
        </Link>
        <Link className="hover:text-white underline underline-offset-4" to="/legal/delete-account">
          Delete account
        </Link>
      </div>
      <div className="text-xs text-white/50">
        We use your location only to show availability and ETA. Notifications are opt-in.
      </div>
    </footer>
  );
}

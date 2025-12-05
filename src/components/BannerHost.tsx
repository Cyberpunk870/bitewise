// src/components/BannerHost.tsx
import React, { useEffect, useState } from 'react';
import ReturnBanner from './ReturnBanner';
import SavingsBar from './SavingsBar';

/**
 * Simple banner stacker to avoid overlap.
 * - SavingsBar stays at top.
 * - ReturnBanner sits above bottom spacing.
 * - Additional banners can be added here with positional logic.
 */
export default function BannerHost() {
  const [showSavings, setShowSavings] = useState(true);
  const [showReturn, setShowReturn] = useState(true);

  useEffect(() => {
    // Could be driven by feature flags or user prefs later
    setShowSavings(true);
    setShowReturn(true);
  }, []);

  return (
    <>
      {showSavings && <SavingsBar />}
      {showReturn && <ReturnBanner />}
    </>
  );
}

// src/lib/seasonalThemes.ts
// Lightweight seasonal theme + promo slot resolver.

export type PromoSlot = {
  title: string;
  body?: string;
  ctaLabel?: string;
  href?: string;
};

export type SeasonalTheme = {
  name: string;
  start: string; // ISO date
  end: string;   // ISO date
  priority?: number;
  accent: string;
  gradient: string;
  heroTitle: string;
  heroSubtitle: string;
  promo?: PromoSlot;
};

// Add/adjust themes here. Keep dates ISO and include a sensible priority.
const THEMES: SeasonalTheme[] = [
  {
    name: "WinterFest",
    start: "2025-11-15",
    end: "2025-12-31",
    priority: 10,
    accent: "#9df2ff",
    gradient: "linear-gradient(135deg, #0f0a2c 0%, #1c1247 50%, #2a1a60 100%)",
    heroTitle: "Winter Fest is on",
    heroSubtitle: "Hot soups, cozy desserts, and limited-time coupons.",
    promo: {
      title: "Flat 25% on warm bowls",
      body: "Use code WARM25 on select dishes.",
      ctaLabel: "View offers",
      href: "/offers",
    },
  },
  {
    name: "New Year Rush",
    start: "2025-12-26",
    end: "2026-01-10",
    priority: 12,
    accent: "#ffd166",
    gradient: "linear-gradient(135deg, #1b0f35 0%, #31104a 45%, #4a0f5c 100%)",
    heroTitle: "New Year, new bites",
    heroSubtitle: "Kick off 2026 with big discounts and fresh arrivals.",
    promo: {
      title: "Extra 15% on favorites",
      body: "Auto-applied on checkout for featured items.",
      ctaLabel: "See favorites",
      href: "/offers",
    },
  },
];

export function resolveSeasonalTheme(now = new Date()): SeasonalTheme | null {
  const today = now.toISOString().slice(0, 10);
  const active = THEMES.filter((t) => t.start <= today && today <= t.end);
  if (!active.length) return null;
  return active.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
}

export function listActiveThemes(now = new Date()): SeasonalTheme[] {
  const today = now.toISOString().slice(0, 10);
  return THEMES.filter((t) => t.start <= today && today <= t.end).sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );
}

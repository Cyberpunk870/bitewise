// src/lib/fuzzyDish.ts
import { DISH_CATALOG, type DishRecord, slugifyDish } from "../data/dishCatalog";

export type FuzzyDishMatch = {
  dish: DishRecord;
  score: number;
  matched: string;
  reason: string;
};

const POPULAR_SLUGS = new Set(
  DISH_CATALOG.filter((d) => d.tags?.includes('popular')).map((d) => d.slug)
);

const TOKEN_SYNONYMS: Record<string, string[]> = {
  biryani: ['hyd biryani', 'dum biryani'],
  paneer: ['cottage cheese'],
  fries: ['french fries', 'chips'],
  burger: ['burgers', 'patty'],
  wrap: ['roll', 'kathi roll'],
  momos: ['dumplings'],
  dosa: ['uttapam'],
  paratha: ['parantha'],
  dessert: ['sweet', 'mithai'],
};

const catalog = DISH_CATALOG.map((dish) => ({
  dish,
  keys: [
    dish.name,
    dish.slug.replace(/-/g, ' '),
    ...(dish.aliases || []),
    ...(dish.tags || []),
    ...(dish.cuisines || []),
  ]
    .map((k) => normalize(k))
    .filter(Boolean),
}));

function normalize(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/&/g, 'and')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();
  tokens.forEach((token) => {
    expanded.add(token);
    TOKEN_SYNONYMS[token]?.forEach((alt) => expanded.add(normalize(alt)));
  });
  return Array.from(expanded);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

export function searchDishes(query: string, limit = 3): FuzzyDishMatch[] {
  const raw = query.trim();
  const q = normalize(raw);
  if (!q) return [];
  const slugQuery = normalize(slugifyDish(query));
  const baseTokens = q.split(/\s+/).filter(Boolean);
  const tokens = expandTokens(baseTokens);

  const matches: FuzzyDishMatch[] = [];

  catalog.forEach(({ dish, keys }) => {
    let bestScore = 0;
    let bestKey = dish.name;
    let bestReason = '';

    keys.forEach((key) => {
      let score = 0;
      if (!key) return;
      let reason = '';
      const slugKey = normalize(slugifyDish(key));
      if (key === q || slugKey === slugQuery) {
        score += 150;
        reason = `Exact match for “${raw}”`;
      }
      if (key.startsWith(q) && q.length >= 3) {
        score += 70;
        if (!reason) reason = `Starts with “${raw}”`;
      }
      if (key.includes(q) && q.length >= 2) {
        score += 45;
        if (!reason) reason = `Contains “${raw}”`;
      }
      const tokenMatches = tokens.filter((t) => key.includes(t));
      if (tokenMatches.length) {
        score += tokenMatches.length * 25;
        if (!reason) {
          const humanToken =
            baseTokens.find((t) => key.includes(t)) || tokenMatches[0];
          reason =
            tokenMatches.length === tokens.length && tokens.length > 1
              ? `Matches keywords ${tokenMatches.join(', ')}`
              : `Matches “${humanToken}”`;
        }
      }
      const dist = levenshtein(key, q);
      const fuzzyScore = Math.max(0, 55 - dist * 6);
      if (fuzzyScore > 0) {
        score += fuzzyScore;
        if (!reason) reason = `Close to “${raw}”`;
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
        bestReason = reason;
      }
    });

    if (bestScore > 25) {
      const cuisineBonus = dish.cuisines?.some((c) => tokens.includes(normalize(c))) ? 12 : 0;
      const popularityBonus = POPULAR_SLUGS.has(dish.slug) ? 10 : 0;
      matches.push({
        dish,
        score: bestScore + cuisineBonus + popularityBonus,
        matched: bestKey,
        reason: bestReason || (dish.cuisines?.[0] ? `Popular ${dish.cuisines[0]} pick` : 'Similar flavour profile'),
      });
    }
  });

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

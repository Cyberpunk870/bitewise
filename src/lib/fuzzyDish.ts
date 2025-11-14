// src/lib/fuzzyDish.ts
import { DISH_CATALOG, type DishRecord, slugifyDish } from "../data/dishCatalog";

export type FuzzyDishMatch = {
  dish: DishRecord;
  score: number;
  matched: string;
};

const catalog = DISH_CATALOG.map((dish) => ({
  dish,
  keys: [
    dish.name,
    dish.slug,
    ...(dish.aliases || []),
    ...(dish.tags || []),
    ...(dish.cuisines || []),
  ].map((k) => k.toLowerCase()),
}));

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
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const slugQuery = slugifyDish(query);

  const matches: FuzzyDishMatch[] = [];

  catalog.forEach(({ dish, keys }) => {
    let bestScore = 0;
    let bestKey = dish.name;

    keys.forEach((key) => {
      let score = 0;
      if (!key) return;
      if (key === q || slugifyDish(key) === slugQuery) score += 120;
      if (key.startsWith(q)) score += 60;
      if (key.includes(q)) score += 35;
      const dist = levenshtein(key, q);
      score += Math.max(0, 40 - dist * 5);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    });

    if (bestScore > 25) {
      matches.push({ dish, score: bestScore, matched: bestKey });
    }
  });

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

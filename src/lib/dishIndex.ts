// src/lib/dishIndex.ts
import { DISH_CATALOG, type DishRecord } from '../data/dishCatalog';

// normalize text for fuzzy compare
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// soft accessor for optional synonyms array
function getSynonyms(dish: DishRecord): string[] {
  const anyDish = dish as any;
  if (Array.isArray(anyDish.synonyms)) {
    return anyDish.synonyms
      .filter((x: unknown) => typeof x === 'string')
      .map((x: string) => x);
  }
  return [];
}

// scoring logic
function score(query: string, dish: DishRecord): number {
  const q = norm(query);
  const n = norm((dish as any).name || '');
  if (!q) return 0;

  // strong signals
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;

  // synonyms
  const syns = getSynonyms(dish).map(norm);
  if (syns.includes(q)) return 85;
  if (syns.some((s) => s.startsWith(q))) return 75;

  // contains
  if (n.includes(q)) return 60;
  if (syns.some((s) => s.includes(q))) return 55;

  return 0;
}

/** Search canonical dishes by free text (for header search & suggestions) */
export function searchDishes(query: string, limit = 12): DishRecord[] {
  const withScores = DISH_CATALOG
    .map((d) => ({ d, s: score(query, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  return withScores.slice(0, limit).map((x) => x.d);
}

/** Best-effort mapper for a menu text to a canonical dish */
export function mapMenuTextToDish(text: string): DishRecord | undefined {
  const q = norm(text);
  if (!q) return undefined;

  // exact or startsWith on name/synonym first
  for (const d of DISH_CATALOG) {
    const n = norm((d as any).name || '');
    const syn = getSynonyms(d).map(norm);

    if (
      n === q ||
      n.startsWith(q) ||
      syn.includes(q) ||
      syn.some((s) => s.startsWith(q))
    ) {
      return d;
    }
  }

  // fallback: highest score
  const [best] = searchDishes(text, 1);
  return best;
}
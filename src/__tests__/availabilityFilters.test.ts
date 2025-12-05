import { AVAILABILITY_DUMMY } from '../data/availability';

function restaurantMenu(r: any): string[] {
  const rawList = (r as any).dishes ?? [ (r as any).dishName ].filter(Boolean);
  return rawList.map((n: any) => String(n).toLowerCase());
}

describe('availability filters', () => {
  it('filters by selected dish names', () => {
    const selected = ['margherita pizza'];
    const matches = AVAILABILITY_DUMMY.filter((r) => {
      const menu = restaurantMenu(r);
      return selected.some((n) => menu.includes(n.toLowerCase()));
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => restaurantMenu(m).includes('margherita pizza'))).toBe(true);
  });

  it('applies rating/price constraints', () => {
    const ratingMin = 4.5;
    const priceMax = 500;
    const filtered = AVAILABILITY_DUMMY.filter((r) => {
      const ratingOk = r.rating >= ratingMin;
      const prices = [r.swiggy.price, r.zomato.price].filter((p) => typeof p === 'number') as number[];
      const priceOk = prices.length === 0 ? false : Math.min(...prices) <= priceMax;
      return ratingOk && priceOk;
    });
    expect(filtered.every((r) => r.rating >= ratingMin)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });
});

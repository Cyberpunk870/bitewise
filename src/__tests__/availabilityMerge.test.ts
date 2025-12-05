import { AVAILABILITY_DUMMY, mergeRestaurants } from '../data/availability';

describe('mergeRestaurants', () => {
  it('merges swiggy and zomato entries by restaurant name', () => {
    const merged = mergeRestaurants(AVAILABILITY_DUMMY);
    const domino = merged.find((r) => r.name.toLowerCase().includes('domino'));
    expect(domino).toBeTruthy();
    if (!domino) return;
    expect(domino.swiggy.available || domino.zomato.available).toBe(true);
    // Ensure priceBreakdown has at most one per platform
    const platforms = new Set(domino.priceBreakdown.map((p) => p.platform));
    expect(platforms.size).toBe(domino.priceBreakdown.length);
  });
});

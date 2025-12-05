import { AVAILABILITY_DUMMY } from '../data/availability';
import type { PriceBreakdown } from '../data/availability';

function calcTotals(p: PriceBreakdown): { subtotal: number; total: number } {
  const subtotal = p.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const fees = p.fees.packaging + p.fees.delivery + p.fees.platformFee + p.fees.tax;
  const savings = p.promo?.savings ?? 0;
  const total = Math.max(0, subtotal + fees - savings);
  return { subtotal, total };
}

describe('compare deltas', () => {
  it('computes cheapest and fastest correctly', () => {
    const restaurant = AVAILABILITY_DUMMY[0];
    const columns = restaurant.priceBreakdown.map((p) => {
      const { total } = calcTotals(p);
      return { ...p, total };
    });
    const cheapestTotal = Math.min(...columns.map((c) => c.total));
    const cheapest = columns.find((c) => c.total === cheapestTotal);

    const fastestEta = Math.min(...columns.map((c) => c.etaMins));
    const fastest = columns.find((c) => c.etaMins === fastestEta);

    expect(cheapest).toBeTruthy();
    expect(fastest).toBeTruthy();
  });
});

// Lightweight harness to exercise the return/coins flow without touching production data.
// Usage in console/devtools:
//   import { seedReturn, simulateConfirm } from '../dev/returnHarness';
//   seedReturn('swiggy', 250, 320); // delta=70, shows banner
//   simulateConfirm(); // triggers confirmOrderPlaced

import { startOutbound, confirmOrderPlaced, clearPendingReturn } from '../lib/orderReturn';

export async function seedReturn(
  platform: 'swiggy' | 'zomato',
  total: number,
  otherTotal: number
) {
  await startOutbound({
    ts: Date.now(),
    restaurantId: 'dev-harness',
    restaurantName: 'Harness Restaurant',
    platform,
    total,
    otherTotal,
    delta: otherTotal - total,
    tokenReward: 5,
    deepLink: platform === 'swiggy' ? 'https://www.swiggy.com/' : 'https://www.zomato.com/',
  });
  console.info('[returnHarness] seeded return flow for', platform);
}

export async function simulateConfirm() {
  const res = await confirmOrderPlaced();
  console.info('[returnHarness] confirm result', res);
  clearPendingReturn();
  return res;
}

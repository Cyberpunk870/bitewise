import { startOutbound, confirmOrderPlaced, getPendingReturn, clearPendingReturn } from '../lib/orderReturn';

// Mock sessionStorage/localStorage for node env
const store: Record<string, string> = {};
const sess: Record<string, string> = {};
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (k: string) => store[k],
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
});
Object.defineProperty(global, 'sessionStorage', {
  value: {
    getItem: (k: string) => sess[k],
    setItem: (k: string, v: string) => { sess[k] = v; },
    removeItem: (k: string) => { delete sess[k]; },
  },
});

// Basic fetch mocks for api calls inside orderReturn
jest.mock('../lib/api', () => ({
  apiMarkOutbound: jest.fn().mockResolvedValue({ id: 'test-id' }),
  markOutbound: jest.fn().mockResolvedValue({ id: 'test-id' }),
  markCompletion: jest.fn().mockResolvedValue({ ok: true }),
  addCoins: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'user1' } }),
}));

jest.mock('../lib/notify', () => ({
  sendLocalNotification: jest.fn(),
}));

describe('return flow', () => {
  afterEach(() => {
    clearPendingReturn();
  });

  it('stashes outbound locally', async () => {
    await startOutbound({
      ts: Date.now(),
      restaurantId: 'r1',
      restaurantName: 'Test R',
      platform: 'swiggy',
      total: 100,
      otherTotal: 120,
      delta: 20,
      tokenReward: 5,
      deepLink: 'https://example.com',
    });
    const ctx = getPendingReturn();
    expect(ctx?.restaurantName).toBe('Test R');
  });

  it('confirms order placed without throwing', async () => {
    await startOutbound({
      ts: Date.now(),
      restaurantId: 'r1',
      restaurantName: 'Test R',
      platform: 'swiggy',
      total: 100,
      otherTotal: 120,
      delta: 20,
      tokenReward: 5,
      deepLink: 'https://example.com',
    });
    const res = await confirmOrderPlaced();
    expect(res).toHaveProperty('tokensAwarded');
  });
});

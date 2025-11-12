// src/lib/apiClient.ts

const BASE_URL =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");


async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  return res.json();
}

export const api = {
  ingest: (events: any[]) => call('/ingest', { method: 'POST', body: JSON.stringify(events) }),
  getTasks: () => call('/tasks'),
  getAchievements: () => call('/achievements'),
  getLeaderboard: () => call('/leaderboard'),
  getAddresses: (userId: string) => call(`/user/addresses?uid=${userId}`),
  saveAddress: (userId: string, addr: any) =>
    call(`/user/addresses`, { method: 'POST', body: JSON.stringify({ userId, addr }) }),
};

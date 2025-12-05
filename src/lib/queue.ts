// Simple in-memory queue with localStorage persistence for offline retries.
// Not bulletproof (clears on reload if storage fails), but good enough for MVP.

type Item = {
  id: string;
  path: string;
  body: any;
  createdAt: number;
};

const LS_KEY = "bw.queue:v1";

function load(): Item[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: Item[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

let queue = load();

export function enqueue(path: string, body: any): Item {
  const item: Item = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    path,
    body,
    createdAt: Date.now(),
  };
  queue.push(item);
  save(queue);
  return item;
}

export function dequeue(id: string) {
  queue = queue.filter((i) => i.id !== id);
  save(queue);
}

export function peekAll() {
  return [...queue];
}

export function clearQueue() {
  queue = [];
  save(queue);
}

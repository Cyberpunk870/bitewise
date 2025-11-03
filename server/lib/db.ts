// server/lib/db.ts
type TableName = 'events' | 'tasks' | 'achievements' | 'leaderboard' | 'addresses';

const store: Record<TableName, any[]> = {
  events: [],
  tasks: [],
  achievements: [],
  leaderboard: [],
  addresses: [],
};

export function insert<T>(table: TableName, data: T): T {
  store[table].push(data);
  return data;
}

export function getAll<T>(table: TableName): T[] {
  return store[table] as T[];
}

export function upsert<T extends { id: string }>(table: TableName, data: T): void {
  const list = store[table];
  const idx = list.findIndex((x) => x.id === data.id);
  if (idx >= 0) list[idx] = data;
  else list.push(data);
}

export function clear(table: TableName) {
  store[table] = [];
}

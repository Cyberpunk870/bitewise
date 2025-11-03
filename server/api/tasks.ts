// server/api/tasks.ts
import { getAll } from '../lib/db';
import { ok } from '../lib/response';
import type { Task } from '../types';

export async function getTasks() {
  const tasks: Task[] = getAll('tasks');
  return ok(tasks);
}

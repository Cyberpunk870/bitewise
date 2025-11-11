// server/api/tasks.ts
import { getAll } from '../lib/db';
import { ok } from '../lib/response';
import type { Task } from '../types';
import express from "express";

const router = express.Router();

export async function getTasks() {
  const tasks: Task[] = getAll('tasks');
  return ok(tasks);
}
export default router;
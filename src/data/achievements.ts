// src/data/achievements.ts
export type Achievement = {
  id: string;
  title: string;
  hint: string;
  icon?: string; // (optional) emoji or asset
  unlock: (ctx: { tokens: number; compares: number; tasksDone: number }) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'starter', title: 'Starter', hint: 'Earn 10 Bits',
    unlock: ({ tokens }) => tokens >= 10 },
  { id: 'scout', title: 'Scout', hint: 'Complete 2 tasks',
    unlock: ({ tasksDone }) => tasksDone >= 2 },
  { id: 'analyst', title: 'Analyst', hint: 'Make 5 compares',
    unlock: ({ compares }) => compares >= 5 },
  { id: 'saver', title: 'Saver', hint: 'Earn 50 Bits',
    unlock: ({ tokens }) => tokens >= 50 },
];

// src/data/achievements.ts
export type AchievementCtx = {
  tokens: number;
  compares: number;
  missions: number;
  streakCurrent: number;
  streakBest: number;
};

export type Achievement = {
  id: string;
  title: string;
  hint: string;
  icon?: string; // (optional) emoji or asset
  unlock: (ctx: AchievementCtx) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'warmup',
    title: 'Warm-Up',
    hint: 'Complete your first mission',
    icon: '🥣',
    unlock: ({ missions }) => missions >= 1,
  },
  {
    id: 'mission-specialist',
    title: 'Mission Specialist',
    hint: 'Complete 15 missions total',
    icon: '🧭',
    unlock: ({ missions }) => missions >= 15,
  },
  {
    id: 'mission-marathon',
    title: 'Mission Marathon',
    hint: 'Complete 45 missions total',
    icon: '🏅',
    unlock: ({ missions }) => missions >= 45,
  },
  {
    id: 'streak-3',
    title: 'Spark Streak',
    hint: 'Reach a 3-day mission streak',
    icon: '🔥',
    unlock: ({ streakBest }) => streakBest >= 3,
  },
  {
    id: 'streak-7',
    title: 'Inferno Streak',
    hint: 'Maintain a 7-day streak',
    icon: '⚡',
    unlock: ({ streakBest }) => streakBest >= 7,
  },
  {
    id: 'streak-14',
    title: 'Relay Champion',
    hint: 'Maintain a 14-day streak',
    icon: '🏆',
    unlock: ({ streakBest }) => streakBest >= 14,
  },
  {
    id: 'analyst',
    title: 'Price Analyst',
    hint: 'Complete 10 compares',
    icon: '📊',
    unlock: ({ compares }) => compares >= 10,
  },
  {
    id: 'collector',
    title: 'Coin Collector',
    hint: 'Earn 100 Bites',
    icon: '💰',
    unlock: ({ tokens }) => tokens >= 100,
  },
];

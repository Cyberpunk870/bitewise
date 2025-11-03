// server/types.ts

export type APIResponse<T = any> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export interface EventPayload {
  userId: string;
  event: string;
  ts: number;
  props?: Record<string, any>;
}

export interface Task {
  id: string;
  name: string;
  desc: string;
  progress: number;
  target: number;
  ready: boolean;
  claimed: boolean;
  reward: number;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  unlocked: boolean;
  reward: number;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  tokens: number;
  compares: number;
  savings: number;
}

export interface UserAddress {
  id: string;
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

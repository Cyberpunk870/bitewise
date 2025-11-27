import { create } from 'zustand';

export type TourStep = {
  id: string;
  selector: string;
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
};

type TourState = {
  steps: TourStep[];
  index: number;
  active: boolean;
  setSteps: (steps: TourStep[]) => void;
  start: () => void;
  next: () => void;
  back: () => void;
  stop: () => void;
};

function markCompleted() {
  try {
    localStorage.setItem('bw.tour.completed', '1');
  } catch {}
}

export const useTour = create<TourState>((set, get) => ({
  steps: [],
  index: 0,
  active: false,
  setSteps: (steps) => set({ steps, index: 0 }),
  start: () => set({ active: true, index: 0 }),
  next: () => {
    const { index, steps } = get();
    if (index >= steps.length - 1) {
      set({ active: false, index: 0 });
      markCompleted();
    } else {
      set({ index: index + 1 });
    }
  },
  back: () => {
    const { index } = get();
    set({ index: Math.max(0, index - 1) });
  },
  stop: () => {
    markCompleted();
    set({ active: false, index: 0 });
  },
}));

export function shouldAutoStartTour() {
  try {
    return localStorage.getItem('bw.tour.completed') !== '1';
  } catch {
    return false;
  }
}

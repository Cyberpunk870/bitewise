// WHY: Single place for onboarding progress in localStorage (no circular deps).
export type OnboardingPersistShape = {
  step?: number;
  completed?: boolean;
  name?: string;
  dob?: string;
  address?: {
    line?: string;
    lat?: number;
    lng?: number;
    label?: string;
  };
  phone?: string;
};

const KEY = 'bw.onboarding.v1';

function load(): OnboardingPersistShape {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingPersistShape) : {};
  } catch {
    return {};
  }
}

function save(patch: Partial<OnboardingPersistShape>) {
  try {
    const current = load();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    /* ignore */
  }
}

function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const persistUtils = { KEY, load, save, clear };
export default persistUtils;

// Simple, typed event helper so we don't sprinkle CustomEvent boilerplate everywhere.

export type AnyEvent = string;

export function emit<T = any>(name: AnyEvent, detail?: T) {
  try { window.dispatchEvent(new CustomEvent(name, { detail } as any)); } catch {}
}

export function on<T = any>(name: AnyEvent, handler: (detail: T) => void) {
  const wrap = (e: Event) => handler((e as CustomEvent<T>).detail);
  window.addEventListener(name, wrap as any);
  return () => window.removeEventListener(name, wrap as any);
}

// src/lib/apiBase.ts
// Computes the API base URL with guards to avoid cross-origin calls from Vercel preview deployments.

const DEFAULT_BASE = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

function normalize(base: string) {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function resolveApiBase(): string {
  const envBase = (import.meta.env.VITE_API_BASE as string | undefined) || "";
  const baseCandidate = envBase || DEFAULT_BASE;

  // In Vercel preview environments, prefer same-origin API to avoid CORS issues.
  if (typeof window !== "undefined") {
    const host = window.location.hostname || "";
    const isVercelPreview = /\.vercel\.app$/i.test(host);
    if (isVercelPreview) {
      if (envBase && /^https?:\/\//i.test(envBase)) {
        try {
          const parsed = new URL(envBase);
          if (parsed.hostname !== host) {
            return normalize("/api");
          }
        } catch {
          return normalize("/api");
        }
      } else if (envBase && envBase.startsWith("/")) {
        return normalize(envBase);
      } else {
        return normalize("/api");
      }
    }
  }

  return normalize(baseCandidate);
}

export function resolvePublicBase(): string {
  return `${resolveApiBase()}/public`;
}

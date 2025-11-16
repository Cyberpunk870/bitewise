// Lazy loader for analytics module so initial bundle stays small.
import type { AnalyticsEventName } from "./analytics";

type Props = Record<string, unknown>;

let analyticsLoader: Promise<typeof import("./analytics")> | null = null;

function loadAnalytics() {
  if (!analyticsLoader) {
    analyticsLoader = import("./analytics");
  }
  return analyticsLoader;
}

export function track(name: AnalyticsEventName, props?: Props) {
  loadAnalytics()
    .then((mod) => mod.track(name, props))
    .catch((err) => {
      console.warn("[analytics] track init failed", err);
    });
}

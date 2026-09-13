import type { DemandState } from "@/server/lib/seo-intelligence/types";
import { qualifiesDemand, type KeywordMetricObservation } from "@/server/lib/keyword-metrics/types";
export type DemandContext = { normalizedQuery: string; language: string; market: string; searchObserved: boolean };
/** Canonical-metric-only bridge; provider envelopes and acquisition failures never enter this function. */
export function demandFromCanonicalMetrics(context: DemandContext, observations: KeywordMetricObservation[]): DemandState {
  return observations.some((observation) => qualifiesDemand(observation, context)) ? "VALIDATED" : context.searchObserved ? "INDICATED" : "UNKNOWN";
}

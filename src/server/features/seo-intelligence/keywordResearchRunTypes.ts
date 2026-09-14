import type { KeywordMetricObservation } from "@/server/lib/keyword-metrics/types";
import type { DemandState } from "@/server/lib/seo-intelligence/types";

export type KeywordResearchRunStatus = "PENDING" | "COMPLETED" | "FAILED";

export type PersistedKeywordResearchObservation = {
  id: string;
  canonicalObservationId: string;
  provider: "dataforseo";
  providerRequestId: string | null;
  rawArtifactRef: string;
  artifactSha256: string;
  acquiredAt: string;
  market: string;
  language: string;
  demandState: DemandState;
  canonicalObservation: KeywordMetricObservation;
};

export type KeywordResearchRun = {
  id: string;
  projectId: string;
  normalizedQuery: string;
  market: string;
  language: string;
  provider: "dataforseo";
  status: KeywordResearchRunStatus;
  failureCode: string | null;
  failureArtifactRef: string | null;
  failureArtifactSha256: string | null;
  createdAt: string;
  completedAt: string | null;
  observations: PersistedKeywordResearchObservation[];
};

export type KeywordResearchRunSummary = Omit<
  KeywordResearchRun,
  "observations"
>;

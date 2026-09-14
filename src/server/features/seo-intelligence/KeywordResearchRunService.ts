import { demandFromCanonicalMetrics } from "@/server/lib/seo-intelligence/metric-demand";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";
import { acquireDataForSeoKeywordMetrics } from "@/server/lib/keyword-metrics/dataforseo";
import type { KeywordMetricRawTransport } from "@/server/lib/keyword-metrics/dataforseo-transport";
import type {
  CanonicalKeywordMetricRequest,
  KeywordMetricObservation,
} from "@/server/lib/keyword-metrics/types";
import type { KeywordResearchRunRepository } from "./KeywordResearchRunRepository";
import type {
  KeywordResearchRun,
  PersistedKeywordResearchObservation,
} from "./keywordResearchRunTypes";

type Repository = Pick<
  typeof KeywordResearchRunRepository,
  "create" | "complete" | "fail" | "get" | "list"
>;
export type KeywordResearchRunDependencies = {
  transport: KeywordMetricRawTransport;
  evidence: ImmutableEvidenceStore;
  repository?: Repository;
  now?: () => string;
  id?: () => string;
};
const normalized = (query: string) =>
  query.normalize("NFKC").trim().toLowerCase();
const SHA256 = /^[a-f0-9]{64}$/;

async function resolveRepository(repository: Repository | undefined) {
  if (repository) return repository;
  const { KeywordResearchRunRepository } =
    await import("./KeywordResearchRunRepository");
  return KeywordResearchRunRepository;
}

function assertCanonicalObservationIntegrity(
  observation: KeywordMetricObservation,
  input: { normalizedQuery: string; market: string; language: string },
) {
  if (
    observation.provider !== "dataforseo" ||
    observation.normalizedQuery !== input.normalizedQuery ||
    observation.market !== input.market ||
    observation.language !== input.language ||
    !observation.evidence.rawArtifactRef ||
    !SHA256.test(observation.evidence.sha256)
  ) {
    throw new Error(
      "Canonical keyword metric observation violates run lineage",
    );
  }
}

export function createKeywordResearchRunService(
  dependencies: KeywordResearchRunDependencies,
) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const id = dependencies.id ?? (() => crypto.randomUUID());
  return {
    async create(input: {
      projectId: string;
      query: string;
      market: CanonicalKeywordMetricRequest["market"];
      language: CanonicalKeywordMetricRequest["language"];
    }): Promise<KeywordResearchRun> {
      const repository = await resolveRepository(dependencies.repository);
      const query = normalized(input.query);
      if (!query) throw new Error("Keyword query is required");
      const createdAt = now();
      const runId = id();
      await repository.create({
        id: runId,
        projectId: input.projectId,
        normalizedQuery: query,
        market: input.market,
        language: input.language,
        provider: "dataforseo",
        createdAt,
      });
      const acquisition = await acquireDataForSeoKeywordMetrics(
        { queries: [query], market: input.market, language: input.language },
        dependencies.transport,
        dependencies.evidence,
      );
      if (acquisition.kind !== "SUCCESS") {
        await repository.fail(
          runId,
          acquisition.kind,
          acquisition.artifact,
          now(),
        );
        const failed = await repository.get(input.projectId, runId);
        if (!failed) throw new Error("Research run persistence failed");
        return failed;
      }
      const completedAt = now();
      const observationIds = new Set<string>();
      const observations: PersistedKeywordResearchObservation[] =
        acquisition.observations.map((item: KeywordMetricObservation) => {
          assertCanonicalObservationIntegrity(item, {
            normalizedQuery: query,
            market: input.market,
            language: input.language,
          });
          if (observationIds.has(item.id))
            throw new Error("Duplicate canonical keyword metric observation");
          observationIds.add(item.id);
          return {
            id: id(),
            canonicalObservationId: item.id,
            provider: item.provider,
            providerRequestId: item.evidence.captureId,
            rawArtifactRef: item.evidence.rawArtifactRef,
            artifactSha256: item.evidence.sha256,
            acquiredAt: item.capturedAt,
            market: item.market,
            language: item.language,
            demandState: demandFromCanonicalMetrics(
              {
                normalizedQuery: query,
                language: input.language,
                market: input.market,
                searchObserved: false,
              },
              [item],
            ),
            canonicalObservation: structuredClone(item),
          };
        });
      const completed: KeywordResearchRun = {
        id: runId,
        projectId: input.projectId,
        normalizedQuery: query,
        market: input.market,
        language: input.language,
        provider: "dataforseo",
        status: "COMPLETED",
        failureCode: null,
        failureArtifactRef: null,
        failureArtifactSha256: null,
        createdAt,
        completedAt,
        observations,
      };
      await repository.complete(completed, observations);
      const persisted = await repository.get(input.projectId, runId);
      if (!persisted) throw new Error("Research run persistence failed");
      return persisted;
    },
    async get(projectId: string, runId: string) {
      return (await resolveRepository(dependencies.repository)).get(
        projectId,
        runId,
      );
    },
    async list(projectId: string) {
      return (await resolveRepository(dependencies.repository)).list(projectId);
    },
  };
}

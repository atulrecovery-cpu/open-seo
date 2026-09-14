import {
  processBuyerLanguageSources,
  type BuyerLanguageRawSource,
} from "@/server/lib/seo-intelligence/buyer-language";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";
import type { BuyerLanguageRunRepository } from "./BuyerLanguageRunRepository";
import type { BuyerLanguageRun } from "./buyerLanguageRunTypes";

type Repository = Pick<
  typeof BuyerLanguageRunRepository,
  "complete" | "get" | "list"
>;
export type BuyerLanguageRunDependencies = {
  evidence: ImmutableEvidenceStore;
  repository?: Repository;
  now?: () => string;
  id?: () => string;
};
const SHA256 = /^[a-f0-9]{64}$/;
async function repository(value: Repository | undefined) {
  if (value) return value;
  return (await import("./BuyerLanguageRunRepository"))
    .BuyerLanguageRunRepository;
}
export function createBuyerLanguageRunService(
  dependencies: BuyerLanguageRunDependencies,
) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const id = dependencies.id ?? (() => crypto.randomUUID());
  return {
    async create(input: {
      projectId: string;
      language: string;
      market: string;
      sources: BuyerLanguageRawSource[];
    }): Promise<BuyerLanguageRun> {
      const result = await processBuyerLanguageSources(
        input.sources,
        dependencies.evidence,
      );
      for (const observation of result.observations)
        if (
          !observation.evidence.rawArtifactRef ||
          !SHA256.test(observation.evidence.sha256)
        )
          throw new Error(
            "Buyer-language observation violates immutable evidence lineage",
          );
      const time = now();
      const run: BuyerLanguageRun = {
        ...result,
        id: id(),
        projectId: input.projectId,
        language: input.language,
        market: input.market,
        createdAt: time,
        completedAt: time,
      };
      const repo = await repository(dependencies.repository);
      await repo.complete(run);
      const persisted = await repo.get(input.projectId, run.id);
      if (!persisted) throw new Error("Buyer-language run persistence failed");
      return persisted;
    },
    async get(projectId: string, runId: string) {
      return (await repository(dependencies.repository)).get(projectId, runId);
    },
    async list(projectId: string) {
      return (await repository(dependencies.repository)).list(projectId);
    },
  };
}

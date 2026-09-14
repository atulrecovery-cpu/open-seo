import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  keywordResearchRunObservations,
  keywordResearchRuns,
} from "@/db/schema";
import type {
  KeywordResearchRun,
  KeywordResearchRunSummary,
  PersistedKeywordResearchObservation,
} from "./keywordResearchRunTypes";

type RunRow = typeof keywordResearchRuns.$inferSelect;
type ObservationRow = typeof keywordResearchRunObservations.$inferSelect;

function summary(row: RunRow): KeywordResearchRunSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    normalizedQuery: row.normalizedQuery,
    market: row.market,
    language: row.language,
    provider: "dataforseo",
    status: row.status as KeywordResearchRun["status"],
    failureCode: row.failureCode,
    failureArtifactRef: row.failureArtifactRef,
    failureArtifactSha256: row.failureArtifactSha256,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function observation(row: ObservationRow): PersistedKeywordResearchObservation {
  return {
    id: row.id,
    canonicalObservationId: row.canonicalObservationId,
    provider: "dataforseo",
    providerRequestId: row.providerRequestId,
    rawArtifactRef: row.rawArtifactRef,
    artifactSha256: row.artifactSha256,
    acquiredAt: row.acquiredAt,
    market: row.market,
    language: row.language,
    demandState:
      row.demandState as PersistedKeywordResearchObservation["demandState"],
    canonicalObservation: JSON.parse(
      row.canonicalObservationJson,
    ) as PersistedKeywordResearchObservation["canonicalObservation"],
  };
}

export const KeywordResearchRunRepository = {
  async create(
    input: Omit<
      KeywordResearchRunSummary,
      | "status"
      | "failureCode"
      | "failureArtifactRef"
      | "failureArtifactSha256"
      | "completedAt"
    >,
  ) {
    await db
      .insert(keywordResearchRuns)
      .values({ ...input, provider: "dataforseo", status: "PENDING" });
  },
  async complete(
    run: KeywordResearchRun,
    observations: PersistedKeywordResearchObservation[],
  ) {
    await db
      .update(keywordResearchRuns)
      .set({ status: "COMPLETED", completedAt: run.completedAt })
      .where(eq(keywordResearchRuns.id, run.id));
    if (observations.length)
      await db
        .insert(keywordResearchRunObservations)
        .values(
          observations.map((item) => ({
            id: item.id,
            runId: run.id,
            canonicalObservationId: item.canonicalObservationId,
            provider: item.provider,
            providerRequestId: item.providerRequestId,
            rawArtifactRef: item.rawArtifactRef,
            artifactSha256: item.artifactSha256,
            acquiredAt: item.acquiredAt,
            market: item.market,
            language: item.language,
            demandState: item.demandState,
            canonicalObservationJson: JSON.stringify(item.canonicalObservation),
            createdAt: run.completedAt ?? run.createdAt,
          })),
        )
        .onConflictDoNothing();
  },
  async fail(
    runId: string,
    code: string,
    artifact: { ref: string; sha256: string } | null,
    completedAt: string,
  ) {
    await db
      .update(keywordResearchRuns)
      .set({
        status: "FAILED",
        failureCode: code,
        failureArtifactRef: artifact?.ref ?? null,
        failureArtifactSha256: artifact?.sha256 ?? null,
        completedAt,
      })
      .where(eq(keywordResearchRuns.id, runId));
  },
  async get(projectId: string, id: string): Promise<KeywordResearchRun | null> {
    const [row] = await db
      .select()
      .from(keywordResearchRuns)
      .where(
        and(
          eq(keywordResearchRuns.projectId, projectId),
          eq(keywordResearchRuns.id, id),
        ),
      );
    if (!row) return null;
    const observations = await db
      .select()
      .from(keywordResearchRunObservations)
      .where(eq(keywordResearchRunObservations.runId, id))
      .orderBy(keywordResearchRunObservations.canonicalObservationId);
    return { ...summary(row), observations: observations.map(observation) };
  },
  async list(projectId: string): Promise<KeywordResearchRunSummary[]> {
    const rows = await db
      .select()
      .from(keywordResearchRuns)
      .where(eq(keywordResearchRuns.projectId, projectId))
      .orderBy(desc(keywordResearchRuns.createdAt));
    return rows.map(summary);
  },
};

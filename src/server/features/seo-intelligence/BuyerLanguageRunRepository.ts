import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  buyerLanguageContradictions,
  buyerLanguageObservations,
  buyerLanguageRuns,
  buyerLanguageUnknowns,
} from "@/db/schema";
import type {
  BuyerLanguageContradiction,
  BuyerLanguageObservation,
  BuyerLanguageSliceResult,
  BuyerLanguageUnknown,
} from "@/server/lib/seo-intelligence/buyer-language";
import type {
  BuyerLanguageRun,
  BuyerLanguageRunSummary,
} from "./buyerLanguageRunTypes";

const summary = (
  row: typeof buyerLanguageRuns.$inferSelect,
): BuyerLanguageRunSummary => ({
  id: row.id,
  projectId: row.projectId,
  language: row.language,
  market: row.market,
  createdAt: row.createdAt,
  completedAt: row.completedAt,
});
export const BuyerLanguageRunRepository = {
  async complete(run: BuyerLanguageRun) {
    await db.insert(buyerLanguageRuns).values({
      id: run.id,
      projectId: run.projectId,
      language: run.language,
      market: run.market,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    });
    if (run.observations.length)
      await db
        .insert(buyerLanguageObservations)
        .values(
          run.observations.map((item) => ({
            // Row identity is run membership; the canonical observation ID
            // remains stable inside the immutable payload and may recur in a
            // later historical run.
            id: `${run.id}:${item.id}`,
            runId: run.id,
            claimKey: item.claimKey,
            language: run.language,
            market: run.market,
            rawArtifactRef: item.evidence.rawArtifactRef,
            artifactSha256: item.evidence.sha256,
            canonicalObservationJson: JSON.stringify(item),
            createdAt: run.completedAt,
          })),
        )
        .onConflictDoNothing();
    if (run.unknowns.length)
      await db
        .insert(buyerLanguageUnknowns)
        .values(
          run.unknowns.map((item) => ({
            id: `${run.id}:${item.id}`,
            runId: run.id,
            canonicalUnknownJson: JSON.stringify(item),
            createdAt: run.completedAt,
          })),
        )
        .onConflictDoNothing();
    if (run.contradictions.length)
      await db
        .insert(buyerLanguageContradictions)
        .values(
          run.contradictions.map((item) => ({
            id: `${run.id}:${item.id}`,
            runId: run.id,
            claimKey: item.claimKey,
            canonicalContradictionJson: JSON.stringify(item),
            createdAt: run.completedAt,
          })),
        )
        .onConflictDoNothing();
  },
  async get(projectId: string, id: string): Promise<BuyerLanguageRun | null> {
    const [row] = await db
      .select()
      .from(buyerLanguageRuns)
      .where(
        and(
          eq(buyerLanguageRuns.projectId, projectId),
          eq(buyerLanguageRuns.id, id),
        ),
      );
    if (!row) return null;
    const [observations, unknowns, contradictions] = await Promise.all([
      db
        .select()
        .from(buyerLanguageObservations)
        .where(eq(buyerLanguageObservations.runId, id))
        .orderBy(buyerLanguageObservations.id),
      db
        .select()
        .from(buyerLanguageUnknowns)
        .where(eq(buyerLanguageUnknowns.runId, id))
        .orderBy(buyerLanguageUnknowns.id),
      db
        .select()
        .from(buyerLanguageContradictions)
        .where(eq(buyerLanguageContradictions.runId, id))
        .orderBy(buyerLanguageContradictions.id),
    ]);
    return {
      ...summary(row),
      observations: observations.map(
        (item) =>
          JSON.parse(item.canonicalObservationJson) as BuyerLanguageObservation,
      ),
      unknowns: unknowns.map(
        (item) => JSON.parse(item.canonicalUnknownJson) as BuyerLanguageUnknown,
      ),
      contradictions: contradictions.map(
        (item) =>
          JSON.parse(
            item.canonicalContradictionJson,
          ) as BuyerLanguageContradiction,
      ),
      admissions: [],
    };
  },
  async list(projectId: string) {
    return (
      await db
        .select()
        .from(buyerLanguageRuns)
        .where(eq(buyerLanguageRuns.projectId, projectId))
        .orderBy(desc(buyerLanguageRuns.createdAt))
    ).map(summary);
  },
};

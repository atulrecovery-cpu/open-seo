import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type * as BuyerLanguageRunRepositoryModule from "./BuyerLanguageRunRepository";
import type { BuyerLanguageRun } from "./buyerLanguageRunTypes";

// This uses the provider-aware D1 schema and the application repository against
// real SQLite. It proves that immutable canonical IDs may recur in history while
// the physical child-row identities remain scoped to their owning run.
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
}));

let client: Client;
let BuyerLanguageRunRepository: typeof BuyerLanguageRunRepositoryModule.BuyerLanguageRunRepository;

const canonicalObservation = {
  id: "buyer-language:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  text: "Reconciling invoices is painful.",
  signalKind: "PAIN" as const,
  speakerOrContext: "https://example.test/reviews/1",
  directlyObserved: true as const,
  category: "SITE_OBSERVED" as const,
  evidenceFunction: "BUYER_LANGUAGE" as const,
  claimKey: "invoice-pain",
  stance: "SUPPORTS" as const,
  evidence: {
    family: "BUYER_LANGUAGE" as const,
    rawArtifactRef:
      "evidence/buyer_language/fixture/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.txt",
    sha256: "a".repeat(64),
    captureId:
      "evidence/buyer_language/fixture/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.txt",
    sourceObservationId: "review-1",
  },
  limits: "OBSERVED_PHRASE_ONLY" as const,
};
const canonicalUnknown = {
  id: "buyer-language-unknown:review-unavailable:SITE_CAPTURED",
  topic: "BUYER_LANGUAGE_SOURCE" as const,
  reason: "PROVENANCE_FAILURE" as const,
  sourceId: "review-unavailable",
  nextAction: "COLLECT_BUYER_LANGUAGE" as const,
};
const canonicalContradiction = {
  id: "buyer-language-contradiction:invoice-pain:observation-a|observation-b",
  claimKey: "invoice-pain",
  supportingObservationIds: ["observation-a"],
  conflictingObservationIds: ["observation-b"],
  status: "OPEN" as const,
  nextAction: "COLLECT_BUYER_LANGUAGE" as const,
};

function historicalRun(id: string): BuyerLanguageRun {
  return {
    id,
    projectId: "project-1",
    language: "en",
    market: "US",
    createdAt: "2026-09-14T00:00:00.000Z",
    completedAt: "2026-09-14T00:01:00.000Z",
    observations: [structuredClone(canonicalObservation)],
    unknowns: [structuredClone(canonicalUnknown)],
    contradictions: [structuredClone(canonicalContradiction)],
    admissions: [],
  };
}

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  vi.doMock("@/db", () => ({ db: testDb }));
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE projects (id TEXT PRIMARY KEY);
    CREATE TABLE buyer_language_runs (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      language TEXT NOT NULL,
      market TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE buyer_language_observations (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      claim_key TEXT NOT NULL,
      language TEXT NOT NULL,
      market TEXT NOT NULL,
      raw_artifact_ref TEXT NOT NULL,
      artifact_sha256 TEXT NOT NULL,
      canonical_observation_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES buyer_language_runs(id) ON DELETE CASCADE
    );
    CREATE TABLE buyer_language_unknowns (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      canonical_unknown_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES buyer_language_runs(id) ON DELETE CASCADE
    );
    CREATE TABLE buyer_language_contradictions (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      claim_key TEXT NOT NULL,
      canonical_contradiction_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES buyer_language_runs(id) ON DELETE CASCADE
    );
  `);
  ({ BuyerLanguageRunRepository } = await import("./BuyerLanguageRunRepository"));
});

afterAll(() => client.close());

describe("BuyerLanguageRunRepository historical identity", () => {
  it("persists identical canonical evidence in isolated runs with run-scoped row IDs", async () => {
    await client.execute({ sql: "INSERT INTO projects (id) VALUES (?)", args: ["project-1"] });
    const runA = historicalRun("buyer-language-run-a");
    const runB = historicalRun("buyer-language-run-b");

    await BuyerLanguageRunRepository.complete(runA);
    await BuyerLanguageRunRepository.complete(runB);

    const [reloadedA, reloadedB] = await Promise.all([
      BuyerLanguageRunRepository.get(runA.projectId, runA.id),
      BuyerLanguageRunRepository.get(runB.projectId, runB.id),
    ]);
    expect(reloadedA).toEqual(runA);
    expect(reloadedB).toEqual(runB);
    expect(reloadedA?.observations[0]?.id).toBe(reloadedB?.observations[0]?.id);
    expect(reloadedA?.unknowns[0]?.id).toBe(reloadedB?.unknowns[0]?.id);
    expect(reloadedA?.contradictions[0]?.id).toBe(
      reloadedB?.contradictions[0]?.id,
    );

    const rows = await Promise.all(
      [
        "buyer_language_observations",
        "buyer_language_unknowns",
        "buyer_language_contradictions",
      ].map((table) =>
        client.execute({ sql: `SELECT id, run_id FROM ${table} ORDER BY id` }),
      ),
    );
    const expectedIds = (canonicalId: string) => [
      { id: `${runA.id}:${canonicalId}`, run_id: runA.id },
      { id: `${runB.id}:${canonicalId}`, run_id: runB.id },
    ];
    expect(rows[0].rows).toEqual(expectedIds(canonicalObservation.id));
    expect(rows[1].rows).toEqual(expectedIds(canonicalUnknown.id));
    expect(rows[2].rows).toEqual(expectedIds(canonicalContradiction.id));

    await client.execute({
      sql: "DELETE FROM buyer_language_runs WHERE id = ?",
      args: [runA.id],
    });
    for (const table of [
      "buyer_language_observations",
      "buyer_language_unknowns",
      "buyer_language_contradictions",
    ]) {
      const result = await client.execute({
        sql: `SELECT run_id FROM ${table} ORDER BY run_id`,
      });
      expect(result.rows).toEqual([{ run_id: runB.id }]);
    }
    expect(await BuyerLanguageRunRepository.get(runA.projectId, runA.id)).toBeNull();
    expect(await BuyerLanguageRunRepository.get(runB.projectId, runB.id)).toEqual(runB);
  });
});

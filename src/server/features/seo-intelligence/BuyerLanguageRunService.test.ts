import { describe, expect, it } from "vitest";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";
import type { BuyerLanguageRun } from "./buyerLanguageRunTypes";
import { createBuyerLanguageRunService } from "./BuyerLanguageRunService";

const source = {
  sourceClass: "SITE_CAPTURED" as const,
  sourceId: "review-1",
  sourceUrl: "https://example.test/review",
  capturedAt: "2026-09-13T00:00:00.000Z",
  provider: "fixture",
  text: "Reconciling invoices is painful.",
  claimKey: "invoice-pain",
  signalKind: "PAIN" as const,
  stance: "SUPPORTS" as const,
};
function fixture(sha = "a".repeat(64)) {
  const values = new Map<string, BuyerLanguageRun>();
  let next = 0;
  const repository = {
    async complete(run: BuyerLanguageRun) {
      if (!values.has(run.id)) values.set(run.id, structuredClone(run));
    },
    async get(projectId: string, id: string) {
      const value = values.get(id);
      return value?.projectId === projectId ? structuredClone(value) : null;
    },
    async list(projectId: string) {
      return [...values.values()]
        .filter((value) => value.projectId === projectId)
        .map(
          ({
            observations: _o,
            unknowns: _u,
            contradictions: _c,
            admissions: _a,
            ...summary
          }) => structuredClone(summary),
        );
    },
  };
  const evidence: ImmutableEvidenceStore = {
    captureArtifact: async () => ({
      ref: `evidence/buyer_language/fixture/${sha}.txt`,
      sha256: sha,
      capturedAt: source.capturedAt,
      provider: "fixture",
      adapterVersion: "phase-3b",
      family: "BUYER_LANGUAGE",
      contentType: "text/plain",
    }),
  };
  return {
    service: createBuyerLanguageRunService({
      evidence,
      repository,
      now: () => "2026-09-13T00:00:00.000Z",
      id: () => `run-${++next}`,
    }),
  };
}
describe("BuyerLanguageRunService", () => {
  it("persists and deterministically reloads canonical observations with immutable lineage", async () => {
    const f = fixture();
    const run = await f.service.create({
      projectId: "p1",
      language: "en",
      market: "US",
      sources: [source],
    });
    expect(run.observations[0]).toMatchObject({
      id: `buyer-language:${"a".repeat(64)}`,
      evidence: {
        rawArtifactRef: `evidence/buyer_language/fixture/${"a".repeat(64)}.txt`,
        sha256: "a".repeat(64),
      },
    });
    expect(await f.service.get("p1", run.id)).toEqual(run);
    expect(await f.service.get("p2", run.id)).toBeNull();
  });
  it("persists unknowns and contradictions without inference on reload", async () => {
    const f = fixture();
    const run = await f.service.create({
      projectId: "p1",
      language: "en",
      market: "US",
      sources: [
        { ...source, sourceId: null },
        source,
        {
          ...source,
          sourceId: "review-2",
          sourceUrl: "https://example.test/review-2",
          text: "Reconciling invoices is easy.",
          stance: "CONTRADICTS",
        },
      ],
    });
    expect(run.unknowns[0]?.id).toContain("buyer-language-unknown");
    expect(run.contradictions[0]).toMatchObject({
      id: expect.stringContaining("buyer-language-contradiction"),
      status: "OPEN",
    });
    expect(await f.service.get("p1", run.id)).toEqual(run);
  });
  it("isolates historical runs and rejects invalid immutable SHA lineage", async () => {
    const f = fixture();
    const first = await f.service.create({
      projectId: "p1",
      language: "en",
      market: "US",
      sources: [source],
    });
    const second = await f.service.create({
      projectId: "p1",
      language: "en",
      market: "US",
      sources: [source],
    });
    expect(first.id).not.toBe(second.id);
    expect(await f.service.list("p1")).toHaveLength(2);
    await expect(
      fixture("invalid").service.create({
        projectId: "p1",
        language: "en",
        market: "US",
        sources: [source],
      }),
    ).rejects.toThrow("immutable evidence lineage");
  });
});

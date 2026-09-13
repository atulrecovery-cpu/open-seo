import { describe, expect, expectTypeOf, it } from "vitest";
import { createR2RawEvidenceStore } from "@/server/lib/serp-providers/evidence";
import { demandFromCanonicalMetrics } from "@/server/lib/seo-intelligence/metric-demand";
import { processBuyerLanguageSources, replayBuyerLanguageSlice, type BuyerLanguageObservation, type BuyerLanguageRawSource } from "@/server/lib/seo-intelligence/buyer-language";
import type { KeywordMetricObservation } from "@/server/lib/keyword-metrics/types";

function memoryStore() {
  const values = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const bucket = { head: async (key: string) => values.has(key) ? {} : null, put: async (key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }) => { values.set(key, { bytes: value, contentType: options.httpMetadata.contentType }); } } as unknown as R2Bucket;
  return { store: createR2RawEvidenceStore(bucket), values };
}
const accepted: BuyerLanguageRawSource = { sourceClass: "SITE_CAPTURED", sourceId: "review-1", sourceUrl: "https://example.test/reviews/1", capturedAt: "2026-09-13T00:00:00.000Z", provider: "fixture-site", text: "I need a faster way to reconcile invoices.", claimKey: "invoice-reconciliation-pain", signalKind: "PAIN", stance: "SUPPORTS" };

describe("buyer-language vertical slice", () => {
  it("captures an accepted buyer source into a canonical provenance-linked observation", async () => {
    const { store, values } = memoryStore();
    const result = await processBuyerLanguageSources([accepted], store);
    expect(result.unknowns).toEqual([]); expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({ text: accepted.text, category: "SITE_OBSERVED", evidenceFunction: "BUYER_LANGUAGE", directlyObserved: true, limits: "OBSERVED_PHRASE_ONLY", evidence: { family: "BUYER_LANGUAGE", sourceObservationId: "review-1" } });
    expect(values.get(result.observations[0].evidence.rawArtifactRef)).toMatchObject({ bytes: new TextEncoder().encode(accepted.text), contentType: "text/plain" });
    expect(result.observations[0].evidence.sha256).toHaveLength(64);
    expect(result.admissions).toEqual([{ sourceId: "review-1", outcome: "ACCEPTED" }]);
  });

  it("rejects untraceable material and records a provenance failure without an observation", async () => {
    const { store } = memoryStore();
    const rejected = await processBuyerLanguageSources([{ ...accepted, sourceClass: "UNTRACEABLE" }], store);
    const missingLineage = await processBuyerLanguageSources([{ ...accepted, sourceId: null }], store);
    expect(rejected).toMatchObject({ observations: [], unknowns: [{ reason: "SOURCE_REJECTED", nextAction: "COLLECT_BUYER_LANGUAGE" }], admissions: [{ outcome: "REJECTED" }] });
    expect(missingLineage).toMatchObject({ observations: [], unknowns: [{ reason: "PROVENANCE_FAILURE", nextAction: "COLLECT_BUYER_LANGUAGE" }], admissions: [{ outcome: "UNKNOWN_INSUFFICIENT_PROVENANCE" }] });
  });

  it("retains contradictory buyer observations as an open contradiction", async () => {
    const { store } = memoryStore();
    const result = await processBuyerLanguageSources([accepted, { ...accepted, sourceId: "review-2", sourceUrl: "https://example.test/reviews/2", text: "Invoice reconciliation is already easy.", stance: "CONTRADICTS" }], store);
    expect(result.observations).toHaveLength(2);
    expect(result.contradictions).toMatchObject([{ claimKey: "invoice-reconciliation-pain", status: "OPEN", nextAction: "COLLECT_BUYER_LANGUAGE" }]);
    expect(result.contradictions[0].supportingObservationIds).toHaveLength(1); expect(result.contradictions[0].conflictingObservationIds).toHaveLength(1);
  });

  it("replays stored canonical evidence without refetching or recapturing", async () => {
    const { store } = memoryStore(); let fetches = 0;
    const first = await processBuyerLanguageSources([accepted], store);
    const replay = replayBuyerLanguageSlice(first);
    expect(replay).toEqual(first); expect(fetches).toBe(0);
  });

  it("keeps buyer-language evidence separate from Phase 3A demand evidence", async () => {
    const { store } = memoryStore();
    const result = await processBuyerLanguageSources([accepted], store);
    expect(result.observations[0].evidence.family).toBe("BUYER_LANGUAGE");
    expect(result.observations[0]).not.toHaveProperty("searchVolume");
    expect(result).not.toHaveProperty("demand");
    expect(await processBuyerLanguageSources([], store)).toMatchObject({ observations: [] });
    const metricShapedSource = { searchVolume: { status: "PRESENT", value: 120 }, evidence: { family: "KEYWORD_METRIC" } } as unknown as BuyerLanguageRawSource;
    expect(await processBuyerLanguageSources([metricShapedSource], store)).toMatchObject({ observations: [], admissions: [{ outcome: "REJECTED" }] });
    expect(demandFromCanonicalMetrics({ normalizedQuery: "invoice reconciliation", language: "en", market: "US", searchObserved: true }, [])).toBe("INDICATED");
    expectTypeOf<BuyerLanguageObservation>().not.toMatchTypeOf<KeywordMetricObservation>();
  });
});

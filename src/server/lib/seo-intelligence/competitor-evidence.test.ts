import { describe, expect, expectTypeOf, it } from "vitest";
import { createR2RawEvidenceStore } from "@/server/lib/serp-providers/evidence";
import { processBuyerLanguageSources, type BuyerLanguageRawSource } from "@/server/lib/seo-intelligence/buyer-language";
import { demandFromCanonicalMetrics } from "@/server/lib/seo-intelligence/metric-demand";
import { processCompetitorSources, replayCompetitorEvidence, type CompetitorRawSource, type CompetitorValidationObservation } from "@/server/lib/seo-intelligence/competitor-evidence";
import type { KeywordMetricObservation } from "@/server/lib/keyword-metrics/types";

function memoryStore() {
  const values = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const bucket = { head: async (key: string) => values.has(key) ? {} : null, put: async (key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }) => { values.set(key, { bytes: value, contentType: options.httpMetadata.contentType }); } } as unknown as R2Bucket;
  return { store: createR2RawEvidenceStore(bucket), values };
}
const identity = { destinationIdentity: "VERIFIED_DESTINATION" as const, destinationUrlUsable: true, destinationDomainUsable: true, domain: "example.test", url: "https://example.test/pricing" };
const source = (claimKind: CompetitorRawSource["claimKind"], text: string, sourceId: string): CompetitorRawSource => ({ sourceClass: "COMPETITOR_PAGE", sourceId, sourceUrl: "https://example.test/pricing", capturedAt: "2026-09-13T00:00:00.000Z", provider: "fixture-site", identity, claimKind, claimKey: `${claimKind}:example.test`, text, stance: "SUPPORTS", ...(claimKind === "PRICING" ? { price: { amount: 49, currency: "USD", billingBasis: "monthly" } } : {}) });

describe("competitor evidence vertical slice", () => {
  it("captures all bounded competitor claim types with exact bytes and shared provenance shape", async () => {
    const { store, values } = memoryStore();
    const inputs = [source("PRODUCT_OR_SERVICE", "Example offers invoice reconciliation software.", "product"), source("PRICING", "Plans start at $49 monthly.", "pricing"), source("FEATURE_CAPABILITY", "Automated reconciliation is included.", "feature"), source("POSITIONING_PROMISE", "Close books faster.", "positioning"), source("TARGET_USER", "Built for finance teams.", "target")];
    const result = await processCompetitorSources(inputs, store);
    expect(result.observations).toHaveLength(5); expect(result.unknowns).toEqual([]); expect(result.admissions.every((entry) => entry.outcome === "ACCEPTED")).toBe(true);
    for (const observation of result.observations) { expect(observation).toMatchObject({ competitorIdentity: { status: "VERIFIED", domain: "example.test" }, category: "COMPETITOR_OBSERVED", evidenceFunction: "COMPETITOR_OFFERING", directlyObserved: true, evidence: { family: "COMPETITOR" }, limits: "OBSERVED_COMPETITOR_CLAIM_ONLY" }); expect(observation.evidence.sha256).toHaveLength(64); expect(values.get(observation.evidence.rawArtifactRef)).toMatchObject({ bytes: new TextEncoder().encode(observation.observedValue), contentType: "text/plain" }); }
  });
  it("rejects weak or opaque identity and preserves missing pricing as distinct unknowns", async () => {
    const { store } = memoryStore();
    const opaque = await processCompetitorSources([
      { ...source("FEATURE_CAPABILITY", "Automated reconciliation.", "opaque"), identity: { ...identity, destinationIdentity: "WRAPPER_ONLY", url: null, domain: null } },
      { ...source("FEATURE_CAPABILITY", "HTTP page.", "http"), identity: { ...identity, url: "http://example.test/features" } },
      { ...source("FEATURE_CAPABILITY", "Malformed URL.", "malformed"), identity: { ...identity, url: "not a url" } },
      { ...source("FEATURE_CAPABILITY", "Name similarity only.", "name-only"), identity: { ...identity, url: null } },
      { ...source("FEATURE_CAPABILITY", "Wrong page.", "wrong-page"), sourceUrl: "https://other.test/features" },
      { ...source("PRICING", "Pricing listed.", "no-price"), price: undefined },
      { ...source("PRODUCT_OR_SERVICE", "Anonymous claim.", "anonymous"), sourceClass: "UNTRACEABLE" },
    ], store);
    expect(opaque.observations).toEqual([]); expect(opaque.unknowns.map((entry) => entry.reason)).toEqual(["IDENTITY_UNVERIFIED", "IDENTITY_UNVERIFIED", "IDENTITY_UNVERIFIED", "IDENTITY_UNVERIFIED", "INSUFFICIENT_PROVENANCE", "AMBIGUOUS_PRICING", "SOURCE_REJECTED"]); expect(opaque.admissions.map((entry) => entry.outcome)).toEqual(["UNKNOWN_IDENTITY", "UNKNOWN_IDENTITY", "UNKNOWN_IDENTITY", "UNKNOWN_IDENTITY", "UNKNOWN_INSUFFICIENT_PROVENANCE", "UNKNOWN_MISSING_CLAIM", "REJECTED"]);
  });
  it("preserves contradictory competitor pricing claims without selecting a best value", async () => {
    const { store } = memoryStore();
    const result = await processCompetitorSources([source("PRICING", "Plans start at $49 monthly.", "price-49"), { ...source("PRICING", "Plans start at $99 monthly.", "price-99"), price: { amount: 99, currency: "USD", billingBasis: "monthly" }, stance: "CONTRADICTS" }], store);
    expect(result.observations).toHaveLength(2); expect(result.observations.map((entry) => entry.price?.amount)).toEqual([49, 99]); expect(result.contradictions).toMatchObject([{ status: "OPEN", nextAction: "VERIFY_COMPETITOR_SOURCE" }]);
  });
  it("replays stored canonical competitor evidence without refetching", async () => {
    const { store } = memoryStore(); let fetches = 0; const first = await processCompetitorSources([source("FEATURE_CAPABILITY", "Automated reconciliation.", "replay")], store); const replay = replayCompetitorEvidence(first);
    expect(replay).toEqual(first); expect(fetches).toBe(0);
  });
  it("keeps buyer language and Phase 3A metrics from manufacturing competitor evidence or demand", async () => {
    const { store } = memoryStore(); const metricShapedSource = { searchVolume: { status: "PRESENT", value: 120 }, evidence: { family: "KEYWORD_METRIC" } } as unknown as CompetitorRawSource;
    const buyerShapedSource = { sourceClass: "SITE_CAPTURED", sourceId: "buyer-1", sourceUrl: "https://buyer.test/review", text: "I need this feature.", claimKey: "buyer-pain", signalKind: "PAIN", stance: "SUPPORTS" } as unknown as CompetitorRawSource;
    expect(await processCompetitorSources([metricShapedSource, buyerShapedSource], store)).toMatchObject({ observations: [], admissions: [{ outcome: "REJECTED" }, { outcome: "REJECTED" }] }); expect(await processCompetitorSources([], store)).toMatchObject({ observations: [] }); expect(demandFromCanonicalMetrics({ normalizedQuery: "invoice reconciliation", language: "en", market: "US", searchObserved: true }, [])).toBe("INDICATED");
    const competitorAsBuyer = { ...source("POSITIONING_PROMISE", "Close books faster.", "competitor-copy"), sourceClass: "COMPETITOR_PAGE" } as unknown as BuyerLanguageRawSource;
    expect(await processBuyerLanguageSources([competitorAsBuyer], store)).toMatchObject({ observations: [], admissions: [{ outcome: "REJECTED" }] }); expectTypeOf<CompetitorValidationObservation>().not.toMatchTypeOf<KeywordMetricObservation>();
  });
});

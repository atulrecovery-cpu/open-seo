import { describe, expect, it } from "vitest";
import { createR2RawEvidenceStore } from "@/server/lib/serp-providers/evidence";
import { processBuyerLanguageSources, type BuyerLanguageRawSource } from "@/server/lib/seo-intelligence/buyer-language";
import { processCompetitorSources, type CompetitorRawSource } from "@/server/lib/seo-intelligence/competitor-evidence";
import { corroborateEvidence, corroborationEvidenceFromBuyer, corroborationEvidenceFromCompetitor, replayCorroboration, type CorroborationEvidence } from "@/server/lib/seo-intelligence/corroboration";

function memoryStore() {
  const values = new Map<string, Uint8Array>();
  const bucket = { head: async (key: string) => values.has(key) ? {} : null, put: async (key: string, value: Uint8Array) => { values.set(key, value); } } as unknown as R2Bucket;
  return createR2RawEvidenceStore(bucket);
}
const proposition = "manual-comment-export";
const buyer = (): BuyerLanguageRawSource => ({ sourceClass: "SITE_CAPTURED", sourceId: "buyer-review", sourceUrl: "https://buyers.test/review/1", capturedAt: "2026-09-13T00:00:00.000Z", provider: "buyer-fixture", text: "Exporting comments manually is painful.", claimKey: proposition, signalKind: "PAIN", stance: "SUPPORTS" });
const competitor = (stance: "SUPPORTS" | "CONTRADICTS" = "SUPPORTS"): CompetitorRawSource => ({ sourceClass: "COMPETITOR_PAGE", sourceId: `competitor-${stance}`, sourceUrl: "https://example.test/features", capturedAt: "2026-09-13T00:00:01.000Z", provider: "competitor-fixture", identity: { destinationIdentity: "VERIFIED_DESTINATION", destinationUrlUsable: true, destinationDomainUsable: true, domain: "example.test", url: "https://example.test/features" }, claimKind: "FEATURE_CAPABILITY", claimKey: proposition, text: stance === "SUPPORTS" ? "Automated comment export is included." : "Comment export is not supported.", stance });
async function independentEvidence() {
  const store = memoryStore(); const buyerResult = await processBuyerLanguageSources([buyer()], store); const competitorResult = await processCompetitorSources([competitor()], store);
  return { buyer: corroborationEvidenceFromBuyer(buyerResult.observations[0]), competitor: corroborationEvidenceFromCompetitor(competitorResult.observations[0]) };
}

describe("deterministic evidence corroboration", () => {
  it("corroborates independently captured buyer and competitor evidence with separate lineage", async () => {
    const { buyer: buyerEvidence, competitor: competitorEvidence } = await independentEvidence(); const originalBuyer = structuredClone(buyerEvidence); const originalCompetitor = structuredClone(competitorEvidence);
    const result = corroborateEvidence([buyerEvidence, competitorEvidence]);
    expect(result).toMatchObject([{ status: "CORROBORATED", normalizedPropositionId: proposition, propositionType: "FEATURE_MATCH", sourceEvidenceFamilies: ["BUYER_LANGUAGE", "COMPETITOR"] }]); expect(result[0].artifactRefs).toHaveLength(2); expect(result[0].shas).toHaveLength(2); expect(buyerEvidence).toEqual(originalBuyer); expect(competitorEvidence).toEqual(originalCompetitor);
  });
  it("rejects same-artifact and same-family false positives", async () => {
    const { buyer: buyerEvidence, competitor: competitorEvidence } = await independentEvidence(); const sameArtifact = { ...competitorEvidence, rawArtifactRef: buyerEvidence.rawArtifactRef, sha256: buyerEvidence.sha256 };
    expect(corroborateEvidence([buyerEvidence, sameArtifact])[0].status).toBe("NOT_CORROBORATED"); expect(corroborateEvidence([buyerEvidence, { ...buyerEvidence, id: "buyer-2", rawArtifactRef: "evidence/buyer/other", sha256: "b".repeat(64) }])[0].status).toBe("NOT_CORROBORATED"); expect(corroborateEvidence([competitorEvidence, { ...competitorEvidence, id: "competitor-2", rawArtifactRef: "evidence/competitor/other", sha256: "c".repeat(64) }])[0].status).toBe("NOT_CORROBORATED");
  });
  it("retains missing sides and deterministic proposition mismatches as unknown", async () => {
    const { buyer: buyerEvidence, competitor: competitorEvidence } = await independentEvidence();
    expect(corroborateEvidence([buyerEvidence])[0].status).toBe("UNKNOWN"); expect(corroborateEvidence([competitorEvidence])[0].status).toBe("UNKNOWN"); expect(corroborateEvidence([buyerEvidence, { ...competitorEvidence, propositionId: "different-proposition" }])[0].status).toBe("UNKNOWN");
  });
  it("preserves contradictory canonical evidence without resolution", async () => {
    const store = memoryStore(); const buyerResult = await processBuyerLanguageSources([buyer()], store); const competitorResult = await processCompetitorSources([competitor("CONTRADICTS")], store); const result = corroborateEvidence([corroborationEvidenceFromBuyer(buyerResult.observations[0]), corroborationEvidenceFromCompetitor(competitorResult.observations[0])]);
    expect(result).toMatchObject([{ status: "CONTRADICTED", contradictionRefs: expect.any(Array) }]); expect(result[0].contradictionRefs).toHaveLength(2); expect(result[0].artifactRefs).toHaveLength(2);
  });
  it("rejects metric-shaped evidence and replays stored corroboration without refetching", async () => {
    const { buyer: buyerEvidence, competitor: competitorEvidence } = await independentEvidence(); let fetches = 0; const metric = { id: "metric", family: "KEYWORD_METRIC", propositionId: proposition, propositionType: "FEATURE_MATCH", stance: "SUPPORTS", rawArtifactRef: "evidence/metric/a", sha256: "a".repeat(64) } as unknown as CorroborationEvidence;
    expect(corroborateEvidence([metric])[0].status).toBe("UNKNOWN"); const first = corroborateEvidence([buyerEvidence, competitorEvidence]); expect(replayCorroboration(first)).toEqual(first); expect(fetches).toBe(0); expect(first[0]).not.toHaveProperty("opportunityScore"); expect(first[0]).not.toHaveProperty("decision");
  });
});

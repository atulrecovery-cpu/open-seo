import type { EvidenceCategory } from "@/server/lib/seo-intelligence/types";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";

export type MarketClaimKind = "MARKET_PRESENCE" | "CATEGORY_ACTIVITY" | "COMMERCIAL_AVAILABILITY" | "GEOGRAPHIC_PRESENCE" | "MARKET_CONSTRAINT";
export type MarketSourceClass = "PUBLIC_REGISTRY" | "MARKETPLACE_LISTING" | "INDUSTRY_PUBLICATION" | "SUPPLIER_DIRECTORY" | "OFFICIAL_COMMERCIAL_PAGE" | "UNTRACEABLE" | "MODEL_INFERRED";
type AcceptedMarketSourceClass = Extract<MarketSourceClass, "PUBLIC_REGISTRY" | "MARKETPLACE_LISTING" | "INDUSTRY_PUBLICATION" | "SUPPLIER_DIRECTORY" | "OFFICIAL_COMMERCIAL_PAGE">;
export type MarketStance = "SUPPORTS" | "CONTRADICTS";
export type MarketRawSource = { sourceClass: MarketSourceClass; sourceId: string | null; sourceUrl: string | null; sourceDomain: string | null; capturedAt: string; provider: string; targetGeography: string; observedGeography: string; claimKind: MarketClaimKind; claimKey: string; text: string; normalizedValue?: string | null; stance: MarketStance };
export type MarketObservation = { id: string; family: "MARKET"; claimKind: MarketClaimKind; normalizedPropositionId: string; targetGeography: string; sourceClass: AcceptedMarketSourceClass; observedText: string; normalizedValue: string | null; sourceUrl: string; sourceDomain: string; capturedAt: string; status: "OBSERVED"; category: Extract<EvidenceCategory, "SITE_OBSERVED">; evidenceFunction: "MARKET_CONTEXT"; stance: MarketStance; evidence: { family: "MARKET"; rawArtifactRef: string; sha256: string; captureId: string; sourceObservationId: string }; limits: "OBSERVED_MARKET_CLAIM_ONLY" };
export type MarketUnknown = { topic: "MARKET_EVIDENCE"; reason: "SOURCE_REJECTED" | "INSUFFICIENT_PROVENANCE" | "GEOGRAPHY_MISMATCH"; sourceId: string | null; nextAction: "COLLECT_MARKET_EVIDENCE" };
export type MarketContradiction = { propositionId: string; supportingObservationIds: string[]; conflictingObservationIds: string[]; status: "OPEN"; nextAction: "COLLECT_MARKET_EVIDENCE" };
export type MarketAdmission = { sourceId: string | null; outcome: "ACCEPTED" | "REJECTED" | "UNKNOWN_INSUFFICIENT_PROVENANCE" | "UNKNOWN_GEOGRAPHY_MISMATCH" };
export type MarketEvidenceResult = { observations: MarketObservation[]; unknowns: MarketUnknown[]; contradictions: MarketContradiction[]; admissions: MarketAdmission[] };

function isAcceptedMarketSourceClass(sourceClass: MarketSourceClass): sourceClass is AcceptedMarketSourceClass { return sourceClass === "PUBLIC_REGISTRY" || sourceClass === "MARKETPLACE_LISTING" || sourceClass === "INDUSTRY_PUBLICATION" || sourceClass === "SUPPLIER_DIRECTORY" || sourceClass === "OFFICIAL_COMMERCIAL_PAGE"; }
function normalized(value: string): string { return value.normalize("NFKC").trim().toLowerCase(); }
function geography(value: string): string { return value.normalize("NFKC").trim().toUpperCase(); }
function verifiedSourceDomain(source: MarketRawSource): string | null {
  if (!source.sourceUrl || !source.sourceDomain) return null;
  try { const url = new URL(source.sourceUrl); return url.protocol === "https:" && url.hostname === normalized(source.sourceDomain) ? url.hostname : null; } catch { return null; }
}
function unknown(source: MarketRawSource, reason: MarketUnknown["reason"]): MarketUnknown { return { topic: "MARKET_EVIDENCE", reason, sourceId: source.sourceId, nextAction: "COLLECT_MARKET_EVIDENCE" }; }
function contradictions(observations: MarketObservation[]): MarketContradiction[] {
  const byProposition = new Map<string, MarketObservation[]>();
  for (const observation of observations) byProposition.set(observation.normalizedPropositionId, [...(byProposition.get(observation.normalizedPropositionId) ?? []), observation]);
  return [...byProposition.entries()].flatMap(([propositionId, values]) => { const supportingObservationIds = values.filter((value) => value.stance === "SUPPORTS").map((value) => value.id); const conflictingObservationIds = values.filter((value) => value.stance === "CONTRADICTS").map((value) => value.id); return supportingObservationIds.length && conflictingObservationIds.length ? [{ propositionId, supportingObservationIds, conflictingObservationIds, status: "OPEN" as const, nextAction: "COLLECT_MARKET_EVIDENCE" as const }] : []; });
}

/** Deterministic, injected market-source slice. It only records independently captured market context. */
export async function processMarketSources(sources: MarketRawSource[], store: ImmutableEvidenceStore): Promise<MarketEvidenceResult> {
  const observations: MarketObservation[] = []; const unknowns: MarketUnknown[] = []; const admissions: MarketAdmission[] = [];
  for (const source of sources) {
    if (!isAcceptedMarketSourceClass(source.sourceClass)) { unknowns.push(unknown(source, "SOURCE_REJECTED")); admissions.push({ sourceId: source.sourceId, outcome: "REJECTED" }); continue; }
    const sourceDomain = verifiedSourceDomain(source);
    if (!source.sourceId || !sourceDomain || !source.text.trim() || !source.claimKey.trim()) { unknowns.push(unknown(source, "INSUFFICIENT_PROVENANCE")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_INSUFFICIENT_PROVENANCE" }); continue; }
    if (geography(source.targetGeography) !== geography(source.observedGeography)) { unknowns.push(unknown(source, "GEOGRAPHY_MISMATCH")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_GEOGRAPHY_MISMATCH" }); continue; }
    let artifact;
    try { artifact = await store.captureArtifact({ family: "MARKET", provider: source.provider, requestMetadata: { sourceClass: source.sourceClass, sourceId: source.sourceId, sourceUrl: source.sourceUrl, sourceDomain, claimKind: source.claimKind, claimKey: source.claimKey, targetGeography: geography(source.targetGeography), observedGeography: geography(source.observedGeography) }, capturedAt: source.capturedAt, status: 200, bytes: new TextEncoder().encode(source.text), providerVersion: null, adapterVersion: "phase-3b", contentType: "text/plain" }); } catch { unknowns.push(unknown(source, "INSUFFICIENT_PROVENANCE")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_INSUFFICIENT_PROVENANCE" }); continue; }
    observations.push({ id: `market:${artifact.sha256}`, family: "MARKET", claimKind: source.claimKind, normalizedPropositionId: normalized(source.claimKey), targetGeography: geography(source.targetGeography), sourceClass: source.sourceClass, observedText: source.text, normalizedValue: source.normalizedValue ?? null, sourceUrl: source.sourceUrl!, sourceDomain, capturedAt: source.capturedAt, status: "OBSERVED", category: "SITE_OBSERVED", evidenceFunction: "MARKET_CONTEXT", stance: source.stance, evidence: { family: "MARKET", rawArtifactRef: artifact.ref, sha256: artifact.sha256, captureId: artifact.ref, sourceObservationId: source.sourceId }, limits: "OBSERVED_MARKET_CLAIM_ONLY" }); admissions.push({ sourceId: source.sourceId, outcome: "ACCEPTED" });
  }
  return { observations, unknowns, contradictions: contradictions(observations), admissions };
}
/** Replay operates entirely on stored canonical market evidence. */
export function replayMarketEvidence(result: MarketEvidenceResult): MarketEvidenceResult { return structuredClone(result); }

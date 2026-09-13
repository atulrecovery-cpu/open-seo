import type { EvidenceCategory } from "@/server/lib/seo-intelligence/types";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";

export type CompetitorClaimKind = "PRODUCT_OR_SERVICE" | "PRICING" | "FEATURE_CAPABILITY" | "POSITIONING_PROMISE" | "TARGET_USER";
export type CompetitorStance = "SUPPORTS" | "CONTRADICTS";
export type CompetitorIdentityInput = { destinationIdentity: "VERIFIED_DESTINATION" | "WRAPPER_ONLY" | "UNVERIFIED_DESTINATION"; destinationUrlUsable: boolean; destinationDomainUsable: boolean; domain: string | null; url: string | null };
export type CompetitorPrice = { amount: number; currency: string; billingBasis: string };
export type CompetitorRawSource = {
  sourceClass: "COMPETITOR_PAGE" | "UNTRACEABLE" | "MODEL_INFERRED";
  sourceId: string | null;
  sourceUrl: string | null;
  capturedAt: string;
  provider: string;
  identity: CompetitorIdentityInput;
  claimKind: CompetitorClaimKind;
  claimKey: string;
  text: string;
  price?: CompetitorPrice;
  stance: CompetitorStance;
};

export type CompetitorEvidence = { family: "COMPETITOR"; rawArtifactRef: string; sha256: string; captureId: string; sourceObservationId: string };
export type CompetitorValidationObservation = {
  id: string;
  competitorIdentity: { status: "VERIFIED"; domain: string; url: string };
  claimKind: CompetitorClaimKind;
  observedValue: string;
  price: CompetitorPrice | null;
  category: Extract<EvidenceCategory, "COMPETITOR_OBSERVED">;
  evidenceFunction: "COMPETITOR_OFFERING";
  directlyObserved: true;
  claimKey: string;
  stance: CompetitorStance;
  evidence: CompetitorEvidence;
  limits: "OBSERVED_COMPETITOR_CLAIM_ONLY";
};
export type CompetitorUnknown = { topic: "COMPETITOR_EVIDENCE"; reason: "SOURCE_REJECTED" | "INSUFFICIENT_PROVENANCE" | "IDENTITY_UNVERIFIED" | "MISSING_CLAIM_EVIDENCE" | "AMBIGUOUS_PRICING"; sourceId: string | null; nextAction: "VERIFY_COMPETITOR_SOURCE" | "VERIFY_PRODUCT_PRICING" };
export type CompetitorContradiction = { claimKey: string; supportingObservationIds: string[]; conflictingObservationIds: string[]; status: "OPEN"; nextAction: "VERIFY_COMPETITOR_SOURCE" };
export type CompetitorAdmission = { sourceId: string | null; outcome: "ACCEPTED" | "REJECTED" | "UNKNOWN_INSUFFICIENT_PROVENANCE" | "UNKNOWN_IDENTITY" | "UNKNOWN_MISSING_CLAIM" };
export type CompetitorEvidenceResult = { observations: CompetitorValidationObservation[]; unknowns: CompetitorUnknown[]; contradictions: CompetitorContradiction[]; admissions: CompetitorAdmission[] };

function verifiedIdentity(identity: CompetitorIdentityInput): identity is CompetitorIdentityInput & { domain: string; url: string } {
  if (identity.destinationIdentity !== "VERIFIED_DESTINATION" || !identity.destinationUrlUsable || !identity.destinationDomainUsable || !identity.domain || !identity.url) return false;
  try { return new URL(identity.url).protocol === "https:" && new URL(identity.url).hostname === identity.domain; } catch { return false; }
}
function sourcePageMatchesIdentity(sourceUrl: string, domain: string): boolean {
  try { const url = new URL(sourceUrl); return url.protocol === "https:" && url.hostname === domain; } catch { return false; }
}
function unknown(source: CompetitorRawSource, reason: CompetitorUnknown["reason"]): CompetitorUnknown {
  return { topic: "COMPETITOR_EVIDENCE", reason, sourceId: source.sourceId, nextAction: reason === "AMBIGUOUS_PRICING" ? "VERIFY_PRODUCT_PRICING" : "VERIFY_COMPETITOR_SOURCE" };
}
function contradictionRecords(observations: CompetitorValidationObservation[]): CompetitorContradiction[] {
  const byClaim = new Map<string, CompetitorValidationObservation[]>();
  for (const observation of observations) byClaim.set(observation.claimKey, [...(byClaim.get(observation.claimKey) ?? []), observation]);
  return [...byClaim.entries()].flatMap(([claimKey, values]) => {
    const supportingObservationIds = values.filter((value) => value.stance === "SUPPORTS").map((value) => value.id);
    const conflictingObservationIds = values.filter((value) => value.stance === "CONTRADICTS").map((value) => value.id);
    return supportingObservationIds.length && conflictingObservationIds.length ? [{ claimKey, supportingObservationIds, conflictingObservationIds, status: "OPEN" as const, nextAction: "VERIFY_COMPETITOR_SOURCE" as const }] : [];
  });
}

/** Deterministic, injected-source competitor slice. It neither fetches nor scores. */
export async function processCompetitorSources(sources: CompetitorRawSource[], store: ImmutableEvidenceStore): Promise<CompetitorEvidenceResult> {
  const observations: CompetitorValidationObservation[] = [];
  const unknowns: CompetitorUnknown[] = [];
  const admissions: CompetitorAdmission[] = [];
  for (const source of sources) {
    if (source.sourceClass !== "COMPETITOR_PAGE") { unknowns.push(unknown(source, "SOURCE_REJECTED")); admissions.push({ sourceId: source.sourceId, outcome: "REJECTED" }); continue; }
    if (!source.sourceId || !source.sourceUrl || !source.text.trim() || !source.claimKey.trim()) { unknowns.push(unknown(source, "INSUFFICIENT_PROVENANCE")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_INSUFFICIENT_PROVENANCE" }); continue; }
    if (!verifiedIdentity(source.identity)) { unknowns.push(unknown(source, "IDENTITY_UNVERIFIED")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_IDENTITY" }); continue; }
    if (!sourcePageMatchesIdentity(source.sourceUrl, source.identity.domain)) { unknowns.push(unknown(source, "INSUFFICIENT_PROVENANCE")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_INSUFFICIENT_PROVENANCE" }); continue; }
    if (source.claimKind === "PRICING" && (!source.price || !Number.isFinite(source.price.amount) || source.price.amount < 0 || !source.price.currency || !source.price.billingBasis)) { unknowns.push(unknown(source, "AMBIGUOUS_PRICING")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_MISSING_CLAIM" }); continue; }
    let artifact;
    try {
      artifact = await store.captureArtifact({ family: "COMPETITOR", provider: source.provider, requestMetadata: { sourceClass: source.sourceClass, sourceId: source.sourceId, sourceUrl: source.sourceUrl, competitorDomain: source.identity.domain, claimKind: source.claimKind, claimKey: source.claimKey }, capturedAt: source.capturedAt, status: 200, bytes: new TextEncoder().encode(source.text), providerVersion: null, adapterVersion: "phase-3b", contentType: "text/plain" });
    } catch { unknowns.push(unknown(source, "INSUFFICIENT_PROVENANCE")); admissions.push({ sourceId: source.sourceId, outcome: "UNKNOWN_INSUFFICIENT_PROVENANCE" }); continue; }
    observations.push({ id: `competitor:${artifact.sha256}`, competitorIdentity: { status: "VERIFIED", domain: source.identity.domain, url: source.identity.url }, claimKind: source.claimKind, observedValue: source.text, price: source.price ?? null, category: "COMPETITOR_OBSERVED", evidenceFunction: "COMPETITOR_OFFERING", directlyObserved: true, claimKey: source.claimKey, stance: source.stance, evidence: { family: "COMPETITOR", rawArtifactRef: artifact.ref, sha256: artifact.sha256, captureId: artifact.ref, sourceObservationId: source.sourceId }, limits: "OBSERVED_COMPETITOR_CLAIM_ONLY" });
    admissions.push({ sourceId: source.sourceId, outcome: "ACCEPTED" });
  }
  return { observations, unknowns, contradictions: contradictionRecords(observations), admissions };
}
/** Replay uses stored canonical evidence only; it cannot capture or refetch. */
export function replayCompetitorEvidence(result: CompetitorEvidenceResult): CompetitorEvidenceResult { return structuredClone(result); }

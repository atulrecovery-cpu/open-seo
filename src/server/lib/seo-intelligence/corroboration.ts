import type { BuyerLanguageObservation } from "@/server/lib/seo-intelligence/buyer-language";
import type { CompetitorValidationObservation } from "@/server/lib/seo-intelligence/competitor-evidence";

export type CorroborationFamily = "BUYER_LANGUAGE" | "COMPETITOR";
export type CorroborationPropositionType = "PROBLEM_EXISTS" | "SOLUTION_EXISTS" | "PRICING_EXISTS" | "FEATURE_MATCH" | "TARGET_USER_MATCH";
export type CorroborationStatus = "CORROBORATED" | "NOT_CORROBORATED" | "CONTRADICTED" | "UNKNOWN";
export type CorroborationEvidence = { id: string; family: CorroborationFamily; propositionId: string; propositionType: CorroborationPropositionType; stance: "SUPPORTS" | "CONTRADICTS"; rawArtifactRef: string; sha256: string };
export type CorroborationRecord = { id: string; normalizedPropositionId: string | null; propositionType: CorroborationPropositionType | null; status: CorroborationStatus; supportingEvidenceRefs: string[]; sourceEvidenceFamilies: CorroborationFamily[]; artifactRefs: string[]; shas: string[]; contradictionRefs: string[]; unknownRefs: string[] };

function normalize(value: string): string { return value.normalize("NFKC").trim().toLowerCase(); }
function unique(values: string[]): string[] { return [...new Set(values)]; }
function competitorPropositionType(observation: CompetitorValidationObservation): CorroborationPropositionType {
  switch (observation.claimKind) {
    case "PRICING": return "PRICING_EXISTS";
    case "FEATURE_CAPABILITY": return "FEATURE_MATCH";
    case "TARGET_USER": return "TARGET_USER_MATCH";
    case "PRODUCT_OR_SERVICE":
    case "POSITIONING_PROMISE": return "SOLUTION_EXISTS";
  }
}

/** Adapters preserve canonical source lineage without changing the source observation. */
export function corroborationEvidenceFromBuyer(observation: BuyerLanguageObservation): CorroborationEvidence {
  return { id: observation.id, family: "BUYER_LANGUAGE", propositionId: observation.claimKey, propositionType: "PROBLEM_EXISTS", stance: observation.stance, rawArtifactRef: observation.evidence.rawArtifactRef, sha256: observation.evidence.sha256 };
}
export function corroborationEvidenceFromCompetitor(observation: CompetitorValidationObservation): CorroborationEvidence {
  return { id: observation.id, family: "COMPETITOR", propositionId: observation.claimKey, propositionType: competitorPropositionType(observation), stance: observation.stance, rawArtifactRef: observation.evidence.rawArtifactRef, sha256: observation.evidence.sha256 };
}

function record(status: CorroborationStatus, evidence: CorroborationEvidence[], propositionId: string | null, propositionType: CorroborationPropositionType | null, contradictionRefs: string[] = [], unknownRefs: string[] = []): CorroborationRecord {
  const ordered = [...evidence].sort((a, b) => a.id.localeCompare(b.id));
  return { id: `corroboration:${propositionId ?? "unknown"}:${ordered.map((item) => item.id).join("|")}`, normalizedPropositionId: propositionId, propositionType, status, supportingEvidenceRefs: ordered.map((item) => item.id), sourceEvidenceFamilies: unique(ordered.map((item) => item.family)), artifactRefs: unique(ordered.map((item) => item.rawArtifactRef)), shas: unique(ordered.map((item) => item.sha256)), contradictionRefs, unknownRefs };
}

/** Pure B9 reducer over stored canonical observations. It fetches, captures, scores, and decides nothing. */
export function corroborateEvidence(evidence: CorroborationEvidence[]): CorroborationRecord[] {
  const allowed = evidence.filter((item) => item.family === "BUYER_LANGUAGE" || item.family === "COMPETITOR");
  const buyers = allowed.filter((item) => item.family === "BUYER_LANGUAGE");
  const competitors = allowed.filter((item) => item.family === "COMPETITOR");
  if (!buyers.length || !competitors.length) {
    const status: CorroborationStatus = allowed.length > 1 ? "NOT_CORROBORATED" : "UNKNOWN";
    return [record(status, allowed, null, null, [], allowed.map((item) => item.id))];
  }
  const buyerByProposition = new Map<string, CorroborationEvidence[]>();
  for (const buyer of buyers) { const key = normalize(buyer.propositionId); buyerByProposition.set(key, [...(buyerByProposition.get(key) ?? []), buyer]); }
  const results: CorroborationRecord[] = [];
  for (const [propositionId, matchingBuyers] of buyerByProposition) {
    const matchingCompetitors = competitors.filter((item) => normalize(item.propositionId) === propositionId);
    if (!matchingCompetitors.length) continue;
    const selected = [...matchingBuyers, ...matchingCompetitors];
    const propositionType = matchingCompetitors[0].propositionType;
    const independent = matchingBuyers.some((buyer) => matchingCompetitors.some((competitor) => buyer.rawArtifactRef !== competitor.rawArtifactRef && buyer.sha256 !== competitor.sha256));
    if (!independent) { results.push(record("NOT_CORROBORATED", selected, propositionId, propositionType)); continue; }
    const hasSupport = selected.some((item) => item.stance === "SUPPORTS");
    const hasConflict = selected.some((item) => item.stance === "CONTRADICTS");
    results.push(record(hasSupport && hasConflict ? "CONTRADICTED" : "CORROBORATED", selected, propositionId, propositionType, hasSupport && hasConflict ? selected.map((item) => item.id) : []));
  }
  return results.length ? results : [record("UNKNOWN", allowed, null, null, [], allowed.map((item) => item.id))];
}
/** Replay is intentionally pure and does not recapture or refetch source evidence. */
export function replayCorroboration(records: CorroborationRecord[]): CorroborationRecord[] { return structuredClone(records); }

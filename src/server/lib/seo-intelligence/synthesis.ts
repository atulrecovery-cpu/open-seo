import type { BuyerLanguageObservation } from "@/server/lib/seo-intelligence/buyer-language";
import type { CompetitorValidationObservation } from "@/server/lib/seo-intelligence/competitor-evidence";
import type { MarketObservation } from "@/server/lib/seo-intelligence/market-evidence";
import type { CorroborationRecord } from "@/server/lib/seo-intelligence/corroboration";

export type SynthesisFamily = "SEARCH_DEMAND" | "BUYER_LANGUAGE" | "COMPETITOR" | "MARKET";
export type FamilyPresence = "PRESENT" | "ABSENT" | "UNKNOWN" | "CONTRADICTED";
export type SynthesisStatus = "ASSEMBLED" | "PARTIAL" | "CONTRADICTED" | "UNKNOWN";
export type SynthesisContext = { targetQuery: string | null; targetLanguage: string | null; targetMarket: string | null; targetTopicId: string | null };
export type StoredSynthesisEvidence = { id: string; family: SynthesisFamily; propositionId: string; propositionType: string; artifactRef: string; sha256: string; context: SynthesisContext };
export type StoredContradiction = { id: string; propositionId: string; context: SynthesisContext };
export type StoredUnknown = { id: string; propositionId: string | null; context: SynthesisContext };
export type EvidenceSynthesisRecord = { synthesisId: string; propositionId: string; propositionType: string; targetTopicId: string | null; targetQuery: string | null; targetLanguage: string | null; targetMarket: string | null; familyPresence: Record<SynthesisFamily, FamilyPresence>; supportingObservationRefs: string[]; supportingArtifactRefs: string[]; supportingShas: string[]; corroborationRefs: string[]; contradictionRefs: string[]; unknownRefs: string[]; evidenceGaps: string[]; synthesisStatus: SynthesisStatus; contractVersion: "phase-3b-synthesis-v1"; generationMetadata: { deterministic: true; generatedAt: string | null } };
export type SynthesisInput = { target: SynthesisContext & { propositionId: string; propositionType: string }; evidence: StoredSynthesisEvidence[]; corroboration: CorroborationRecord[]; contradictions: StoredContradiction[]; unknowns: StoredUnknown[]; generatedAt?: string | null };
export type SynthesisResult = { kind: "SUCCESS"; record: EvidenceSynthesisRecord } | { kind: "CONTRACT_VIOLATION"; reason: "FORBIDDEN_SCORE_OR_DECISION_FIELD" };

const families: SynthesisFamily[] = ["SEARCH_DEMAND", "BUYER_LANGUAGE", "COMPETITOR", "MARKET"];
const emptyContext: SynthesisContext = { targetQuery: null, targetLanguage: null, targetMarket: null, targetTopicId: null };
const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();
const unique = (values: string[]) => [...new Set(values)];
function contextMatches(target: SynthesisContext, item: SynthesisContext): boolean { return (["targetQuery", "targetLanguage", "targetMarket", "targetTopicId"] as const).every((key) => item[key] === null || target[key] === null || normalize(item[key]!) === normalize(target[key]!)); }
function forbidden(value: unknown): boolean { return Boolean(value && typeof value === "object" && ("opportunityScore" in value || "attractivenessScore" in value || "decision" in value || "buildVerdict" in value || "recommendation" in value)); }

export function synthesisEvidenceFromBuyer(observation: BuyerLanguageObservation): StoredSynthesisEvidence { return { id: observation.id, family: "BUYER_LANGUAGE", propositionId: observation.claimKey, propositionType: "PROBLEM_EXISTS", artifactRef: observation.evidence.rawArtifactRef, sha256: observation.evidence.sha256, context: emptyContext }; }
export function synthesisEvidenceFromCompetitor(observation: CompetitorValidationObservation): StoredSynthesisEvidence { return { id: observation.id, family: "COMPETITOR", propositionId: observation.claimKey, propositionType: observation.claimKind, artifactRef: observation.evidence.rawArtifactRef, sha256: observation.evidence.sha256, context: emptyContext }; }
export function synthesisEvidenceFromMarket(observation: MarketObservation): StoredSynthesisEvidence { return { id: observation.id, family: "MARKET", propositionId: observation.normalizedPropositionId, propositionType: observation.claimKind, artifactRef: observation.evidence.rawArtifactRef, sha256: observation.evidence.sha256, context: { ...emptyContext, targetMarket: observation.targetGeography } }; }

/** Pure structural assembly over stored canonical evidence; it neither acquires nor scores. */
export function assembleEvidenceSynthesis(input: SynthesisInput): SynthesisResult {
  if (forbidden(input) || input.evidence.some(forbidden) || input.corroboration.some(forbidden)) return { kind: "CONTRACT_VIOLATION", reason: "FORBIDDEN_SCORE_OR_DECISION_FIELD" };
  const target = input.target; const matching = input.evidence.filter((item) => normalize(item.propositionId) === normalize(target.propositionId) && contextMatches(target, item.context));
  const contradictionRefs = input.contradictions.filter((item) => normalize(item.propositionId) === normalize(target.propositionId) && contextMatches(target, item.context)).map((item) => item.id);
  const unknownRefs = input.unknowns.filter((item) => item.propositionId === null || (normalize(item.propositionId) === normalize(target.propositionId) && contextMatches(target, item.context))).map((item) => item.id);
  const byFamily = Object.fromEntries(families.map((family) => [family, matching.some((item) => item.family === family) ? "PRESENT" : "UNKNOWN"])) as Record<SynthesisFamily, FamilyPresence>;
  for (const contradiction of input.contradictions.filter((item) => contradictionRefs.includes(item.id))) for (const family of families) if (matching.some((item) => item.family === family)) byFamily[family] = "CONTRADICTED";
  const validCorroboration = input.corroboration.filter((item) => normalize(item.normalizedPropositionId ?? "") === normalize(target.propositionId) && item.supportingEvidenceRefs.some((ref) => matching.some((evidence) => evidence.id === ref && evidence.family === "BUYER_LANGUAGE")) && item.supportingEvidenceRefs.some((ref) => matching.some((evidence) => evidence.id === ref && evidence.family === "COMPETITOR")));
  const invalidCorroboration = input.corroboration.filter((item) => normalize(item.normalizedPropositionId ?? "") === normalize(target.propositionId) && !validCorroboration.includes(item));
  const deduped: StoredSynthesisEvidence[] = []; const seenIds = new Set<string>(); const seenArtifacts = new Set<string>(); const seenShas = new Set<string>(); let duplicateLineage = false;
  for (const item of matching) { if (seenIds.has(item.id) || seenArtifacts.has(item.artifactRef) || seenShas.has(item.sha256)) { duplicateLineage = true; continue; } seenIds.add(item.id); seenArtifacts.add(item.artifactRef); seenShas.add(item.sha256); deduped.push(item); }
  const presentCount = families.filter((family) => byFamily[family] === "PRESENT").length;
  const status: SynthesisStatus = contradictionRefs.length ? "CONTRADICTED" : !deduped.length ? "UNKNOWN" : presentCount === families.length && !duplicateLineage ? "ASSEMBLED" : "PARTIAL";
  const gaps = families.filter((family) => byFamily[family] === "UNKNOWN").map((family) => `${family}:unknown`); if (duplicateLineage) gaps.push("independence:shared-lineage"); if (invalidCorroboration.length) gaps.push("corroboration:underlying-refs-missing");
  const record: EvidenceSynthesisRecord = { synthesisId: `synthesis:${normalize(target.propositionId)}`, propositionId: normalize(target.propositionId), propositionType: target.propositionType, targetTopicId: target.targetTopicId, targetQuery: target.targetQuery, targetLanguage: target.targetLanguage, targetMarket: target.targetMarket, familyPresence: byFamily, supportingObservationRefs: deduped.map((item) => item.id), supportingArtifactRefs: deduped.map((item) => item.artifactRef), supportingShas: deduped.map((item) => item.sha256), corroborationRefs: validCorroboration.map((item) => item.id), contradictionRefs, unknownRefs: unique([...unknownRefs, ...invalidCorroboration.map((item) => item.id)]), evidenceGaps: gaps, synthesisStatus: status, contractVersion: "phase-3b-synthesis-v1", generationMetadata: { deterministic: true, generatedAt: input.generatedAt ?? null } };
  return { kind: "SUCCESS", record };
}
export function replayEvidenceSynthesis(record: EvidenceSynthesisRecord): EvidenceSynthesisRecord { return structuredClone(record); }

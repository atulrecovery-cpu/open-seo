import { z } from "zod";

export const SEO_INTELLIGENCE_SCHEMA_VERSION = "seo-intelligence-v1";
export const SEO_INTELLIGENCE_VERSION = "phase-2.0";

export const evidenceCategorySchema = z.enum(["USER_PROVIDED", "SEARCH_OBSERVED", "PROVIDER_METRIC", "SITE_OBSERVED", "COMPETITOR_OBSERVED", "MODEL_INFERRED", "DERIVED", "UNKNOWN"]);
export type EvidenceCategory = z.infer<typeof evidenceCategorySchema>;
export const demandStateSchema = z.enum(["VALIDATED", "INDICATED", "NOT_VALIDATED", "UNKNOWN"]);
export type DemandState = z.infer<typeof demandStateSchema>;
export const intentClassSchema = z.enum(["informational", "commercial_investigation", "transactional", "navigational", "local", "mixed", "unknown"]);
export type IntentClass = z.infer<typeof intentClassSchema>;

export type EvidenceRef = { id: string; category: EvidenceCategory; sourceObservationId: string; captureId: string };
export type QueryObservation = { id: string; originalQuery: string; normalizedQuery: string; sourceType: string; sourceProvider: string | null; engine: string | null; language: string; region: string; capturedAt: string; evidence: EvidenceRef };
export type QuerySignal = { type: "OBSERVED_ORGANIC_SERP_QUERY" | "SUGGESTION" | "RELATED_SEARCH" | "PAA_QUESTION" | "USER_PROVIDED_QUERY" | "KEYWORD_METRIC" | "COMPETITOR_PHRASE" | "MODEL_GENERATED_CANDIDATE"; evidence: EvidenceRef };
export type IntentAssessment = { intent: IntentClass; confidence: number; basis: string[]; evidenceRefs: string[]; category: EvidenceCategory };
export type CommercialSignal = { type: "pricing" | "comparison" | "alternative" | "purchase" | "software_tool" | "service_provider" | "solution_seeking" | "local_service"; matchedBasis: string; confidence: number; source: "DETERMINISTIC"; evidence: EvidenceRef };
export type ProblemSignal = { category: "how_to" | "why" | "fix" | "remove" | "convert" | "download" | "constraint" | "automation" | "best_way" | "tool_app" | "alternative" | "value"; query: string; confidence: number; directlyObserved: boolean; evidence: EvidenceRef };
export type JTBD = { actor: string | null; task: string | null; desiredOutcome: string | null; constraint: string | null; basis: "OBSERVED" | "INFERRED"; evidenceRefs: string[] };
export type CompetitorObservation = { type: "SERP_COMPETITOR" | "PRODUCT_COMPETITOR" | "CONTENT_COMPETITOR" | "UNKNOWN_COMPETITOR_TYPE"; domain: string; url: string; queryId: string; organicPosition: number; title: string | null; snippet: string | null; evidence: EvidenceRef };
export type UnknownRecord = { topic: string; reason: string; evidenceRefs: string[] };
export type ContradictionRecord = { claim: string; supportingEvidenceRefs: string[]; conflictingEvidenceRefs: string[]; status: "OPEN" | "RESOLVED" | "INSUFFICIENT_EVIDENCE"; notes: string };
export type NextValidationAction = { type: "OBTAIN_KEYWORD_METRIC" | "INSPECT_TOP_COMPETITORS" | "VERIFY_PRODUCT_PRICING" | "VALIDATE_MARKET_LOCALIZATION" | "INSPECT_PAA" | "COLLECT_BUYER_LANGUAGE"; reason: string; evidenceRefs: string[] };
export type OpportunitySignal = { id: string; queryId: string; demandState: DemandState; intent: IntentAssessment; problemSignals: ProblemSignal[]; commercialSignals: CommercialSignal[]; competitors: CompetitorObservation[]; evidenceRefs: string[]; unknowns: UnknownRecord[]; confidence: "WEAK" | "EMERGING" | "PROMISING" | "STRONG_EVIDENCE"; nextAction: NextValidationAction };

export type CanonicalCompetitorInput = { destinationIdentity: "VERIFIED_DESTINATION" | "WRAPPER_ONLY" | "UNVERIFIED_DESTINATION"; destinationUrlUsable: boolean; destinationDomainUsable: boolean; domain: string | null; url: string | null; organicPosition: number; title: string | null; snippet: string | null; evidence: EvidenceRef };
export type IntelligenceInput = { observation: QueryObservation; signals: QuerySignal[]; competitors: CanonicalCompetitorInput[]; configurationVersion: string; demandInspection?: "NOT_VALIDATED" };
export type IntelligenceReport = { schema_version: string; intelligence_version: string; generated_at: string; source_observation_ids: string[]; configuration_version: string; observed: { query: QueryObservation; signals: QuerySignal[]; competitors: CompetitorObservation[] }; derived: { demand: DemandState; intent: IntentAssessment; commercialSignals: CommercialSignal[]; problemSignals: ProblemSignal[]; jtbd: JTBD; opportunity: OpportunitySignal }; model_inferred: unknown[]; unknowns: UnknownRecord[]; contradictions: ContradictionRecord[]; next_validation_actions: NextValidationAction[] };

export const intelligenceReportSchema: z.ZodType<IntelligenceReport> = z.object({
  schema_version: z.literal(SEO_INTELLIGENCE_SCHEMA_VERSION), intelligence_version: z.string(), generated_at: z.string(), source_observation_ids: z.array(z.string()), configuration_version: z.string(),
  observed: z.any(), derived: z.any(), model_inferred: z.array(z.unknown()), unknowns: z.array(z.any()), contradictions: z.array(z.any()), next_validation_actions: z.array(z.any()),
}) as z.ZodType<IntelligenceReport>;

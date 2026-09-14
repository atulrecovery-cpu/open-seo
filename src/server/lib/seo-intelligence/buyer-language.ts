import type { EvidenceCategory } from "@/server/lib/seo-intelligence/types";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";

export type BuyerLanguageSignalKind =
  | "PAIN"
  | "TASK"
  | "DESIRED_OUTCOME"
  | "CONSTRAINT"
  | "FRUSTRATION"
  | "COMPARISON_NEED"
  | "PURCHASE_CONSIDERATION";
export type BuyerLanguageSourceClass =
  | "SITE_CAPTURED"
  | "USER_PROVIDED"
  | "MODEL_INFERRED"
  | "UNTRACEABLE";
export type BuyerLanguageStance = "SUPPORTS" | "CONTRADICTS";

export type BuyerLanguageRawSource = {
  sourceClass: BuyerLanguageSourceClass;
  sourceId: string | null;
  sourceUrl: string | null;
  capturedAt: string;
  provider: string;
  text: string;
  claimKey: string;
  signalKind: BuyerLanguageSignalKind;
  stance: BuyerLanguageStance;
};

export type BuyerLanguageObservation = {
  id: string;
  text: string;
  signalKind: BuyerLanguageSignalKind;
  speakerOrContext: string;
  directlyObserved: true;
  category: Extract<EvidenceCategory, "SITE_OBSERVED">;
  evidenceFunction: "BUYER_LANGUAGE";
  claimKey: string;
  stance: BuyerLanguageStance;
  evidence: {
    family: "BUYER_LANGUAGE";
    rawArtifactRef: string;
    sha256: string;
    captureId: string;
    sourceObservationId: string;
  };
  limits: "OBSERVED_PHRASE_ONLY";
};

export type BuyerLanguageUnknown = {
  id: string;
  topic: "BUYER_LANGUAGE_SOURCE";
  reason: "SOURCE_REJECTED" | "PROVENANCE_FAILURE";
  sourceId: string | null;
  nextAction: "COLLECT_BUYER_LANGUAGE";
};

export type BuyerLanguageAdmission = {
  sourceId: string | null;
  outcome: "ACCEPTED" | "REJECTED" | "UNKNOWN_INSUFFICIENT_PROVENANCE";
};

export type BuyerLanguageContradiction = {
  id: string;
  claimKey: string;
  supportingObservationIds: string[];
  conflictingObservationIds: string[];
  status: "OPEN";
  nextAction: "COLLECT_BUYER_LANGUAGE";
};

export type BuyerLanguageSliceResult = {
  observations: BuyerLanguageObservation[];
  unknowns: BuyerLanguageUnknown[];
  contradictions: BuyerLanguageContradiction[];
  admissions: BuyerLanguageAdmission[];
};

function acceptedSiteSource(source: BuyerLanguageRawSource): boolean {
  return (
    source.sourceClass === "SITE_CAPTURED" &&
    Boolean(source.sourceId) &&
    Boolean(source.sourceUrl) &&
    /^https:\/\//.test(source.sourceUrl ?? "") &&
    Boolean(source.text.trim()) &&
    Boolean(source.claimKey.trim())
  );
}

function unknownFor(source: BuyerLanguageRawSource): BuyerLanguageUnknown {
  return {
    id: `buyer-language-unknown:${source.sourceId ?? "missing"}:${source.sourceClass}`,
    topic: "BUYER_LANGUAGE_SOURCE",
    reason:
      source.sourceClass === "SITE_CAPTURED"
        ? "PROVENANCE_FAILURE"
        : "SOURCE_REJECTED",
    sourceId: source.sourceId,
    nextAction: "COLLECT_BUYER_LANGUAGE",
  };
}

function contradictions(
  observations: BuyerLanguageObservation[],
): BuyerLanguageContradiction[] {
  const byClaim = new Map<string, BuyerLanguageObservation[]>();
  for (const observation of observations)
    byClaim.set(observation.claimKey, [
      ...(byClaim.get(observation.claimKey) ?? []),
      observation,
    ]);
  return [...byClaim.entries()].flatMap(([claimKey, values]) => {
    const supportingObservationIds = values
      .filter((value) => value.stance === "SUPPORTS")
      .map((value) => value.id);
    const conflictingObservationIds = values
      .filter((value) => value.stance === "CONTRADICTS")
      .map((value) => value.id);
    return supportingObservationIds.length && conflictingObservationIds.length
      ? [
          {
            id: `buyer-language-contradiction:${claimKey}:${[...supportingObservationIds, ...conflictingObservationIds].sort().join("|")}`,
            claimKey,
            supportingObservationIds,
            conflictingObservationIds,
            status: "OPEN" as const,
            nextAction: "COLLECT_BUYER_LANGUAGE" as const,
          },
        ]
      : [];
  });
}

/** Deterministic, injected-source vertical slice. It does not fetch or score. */
export async function processBuyerLanguageSources(
  sources: BuyerLanguageRawSource[],
  store: ImmutableEvidenceStore,
): Promise<BuyerLanguageSliceResult> {
  const observations: BuyerLanguageObservation[] = [];
  const unknowns: BuyerLanguageUnknown[] = [];
  const admissions: BuyerLanguageAdmission[] = [];
  for (const source of sources) {
    if (!acceptedSiteSource(source)) {
      unknowns.push(unknownFor(source));
      admissions.push({
        sourceId: source.sourceId,
        outcome:
          source.sourceClass === "SITE_CAPTURED"
            ? "UNKNOWN_INSUFFICIENT_PROVENANCE"
            : "REJECTED",
      });
      continue;
    }
    let artifact;
    try {
      artifact = await store.captureArtifact({
        family: "BUYER_LANGUAGE",
        provider: source.provider,
        requestMetadata: {
          sourceClass: source.sourceClass,
          sourceId: source.sourceId,
          sourceUrl: source.sourceUrl,
          claimKey: source.claimKey,
        },
        capturedAt: source.capturedAt,
        status: 200,
        bytes: new TextEncoder().encode(source.text),
        providerVersion: null,
        adapterVersion: "phase-3b",
        contentType: "text/plain",
      });
    } catch {
      unknowns.push({
        id: `buyer-language-unknown:${source.sourceId ?? "missing"}:provenance`,
        topic: "BUYER_LANGUAGE_SOURCE",
        reason: "PROVENANCE_FAILURE",
        sourceId: source.sourceId,
        nextAction: "COLLECT_BUYER_LANGUAGE",
      });
      admissions.push({
        sourceId: source.sourceId,
        outcome: "UNKNOWN_INSUFFICIENT_PROVENANCE",
      });
      continue;
    }
    observations.push({
      id: `buyer-language:${artifact.sha256}`,
      text: source.text,
      signalKind: source.signalKind,
      speakerOrContext: source.sourceUrl!,
      directlyObserved: true,
      category: "SITE_OBSERVED",
      evidenceFunction: "BUYER_LANGUAGE",
      claimKey: source.claimKey,
      stance: source.stance,
      evidence: {
        family: "BUYER_LANGUAGE",
        rawArtifactRef: artifact.ref,
        sha256: artifact.sha256,
        captureId: artifact.ref,
        sourceObservationId: source.sourceId!,
      },
      limits: "OBSERVED_PHRASE_ONLY",
    });
    admissions.push({ sourceId: source.sourceId, outcome: "ACCEPTED" });
  }
  return {
    observations,
    unknowns,
    contradictions: contradictions(observations),
    admissions,
  };
}

/** Replay operates only on stored canonical evidence; it performs no capture or source fetch. */
export function replayBuyerLanguageSlice(
  result: BuyerLanguageSliceResult,
): BuyerLanguageSliceResult {
  return structuredClone(result);
}

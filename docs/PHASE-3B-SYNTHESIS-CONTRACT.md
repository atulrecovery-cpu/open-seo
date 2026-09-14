# Phase 3B synthesis contract

## Status and scope

This is a design-only contract for a future deterministic synthesis layer. It
assembles frozen canonical evidence into structural records; it creates no raw
evidence, fetches no source, and changes none of the existing canonical
observations, artifacts, hashes, contradictions, or unknowns.

Frozen inputs are `KEYWORD_METRIC`/Phase 3A demand, `BUYER_LANGUAGE`,
`COMPETITOR`, `MARKET`, and B9 corroboration. This contract adds neither
scoring nor business decisions.

## Immutable-input rule

Synthesis has references, never replacement evidence. It must not:

- rewrite an observation, artifact ref, SHA, capture ID, or evidence family;
- merge source observations into a synthetic source observation;
- mutate, resolve, or hide a contradiction record;
- remove an unknown merely because another family contains evidence; or
- create a source observation from a synthesis, corroboration, model, or gap.

## Family boundaries

| Family | Bounded question it answers | It must not establish |
| --- | --- | --- |
| Search demand | Is a query’s demand state observed for its query/language/market? | Buyer wording, competitor identity, or commercial market presence. |
| Buyer language | What buyer pain, need, task, or wording is directly observed? | Demand validation, competitor identity, or market presence. |
| Competitor | What verified competitor offering, price, feature, positioning, or target user is observed? | Buyer pain, demand, or general market size. |
| Market | What source-observed commercial/category/geographic market fact exists? | Keyword demand, buyer wording, or a competitor fact not independently captured as market evidence. |
| Corroboration | Do independently captured buyer and competitor records agree on a bounded proposition? | A new source fact, market evidence, search demand, or a score. |

No family may manufacture another. A synthesis record may show their coexistence
for a proposition but does not alter the meaning of any family.

## Canonical synthesis record

Future implementation must produce a provider-neutral `EvidenceSynthesisRecord`:

```ts
type FamilyPresence = "PRESENT" | "ABSENT" | "UNKNOWN" | "CONTRADICTED";
type SynthesisStatus = "ASSEMBLED" | "PARTIAL" | "CONTRADICTED" | "UNKNOWN";

type EvidenceSynthesisRecord = {
  synthesisId: string;
  propositionId: string;
  propositionType: string;
  targetTopicId: string | null;
  targetQuery: string | null;
  targetLanguage: string | null;
  targetMarket: string | null;
  familyPresence: Record<"SEARCH_DEMAND" | "BUYER_LANGUAGE" | "COMPETITOR" | "MARKET", FamilyPresence>;
  supportingObservationRefs: string[];
  supportingArtifactRefs: string[];
  supportingShas: string[];
  corroborationRefs: string[];
  contradictionRefs: string[];
  unknownRefs: string[];
  evidenceGaps: string[];
  synthesisStatus: SynthesisStatus;
  contractVersion: string;
  generationMetadata: { deterministic: true; generatedAt: string | null };
};
```

The record must not contain opportunity/attractiveness/confidence scores,
weights, rankings, revenue/TAM estimates, recommendation fields, or a
`BUILD`/`TEST`/`AVOID` decision.

`ABSENT` is permitted only when an explicit, evidence-backed absence claim
exists in the applicable family. Missing evidence is `UNKNOWN`, never `ABSENT`.

## Proposition identity and context isolation

First implementation uses exact deterministic matching only:

1. normalize an existing canonical proposition/claim identity with NFKC,
   trimming, and case normalization;
2. require exact equality after normalization;
3. require matching target market, language, and query/topic context whenever
   those fields apply to both records; and
4. return `UNKNOWN`/`UNRESOLVED` when no deterministic identity exists.

There is no fuzzy matching, LLM matching, semantic embedding match, or implicit
cross-market/language transfer. Evidence observed for US must not contribute to
a DE synthesis without independently valid DE context.

## Presence, status, contradictions, and unknowns

For a deterministically identified proposition:

- `ASSEMBLED`: more than one relevant family is present and no unresolved
  contradiction affects the proposition. This is structural assembly, not
  opportunity validation.
- `PARTIAL`: relevant evidence is present but one or more required/contextual
  families remain unknown; for example buyer + competitor + corroboration with
  market unknown.
- `CONTRADICTED`: any unresolved contradiction linked to the proposition is
  retained. Supporting evidence cannot cancel it; there is no majority vote,
  newest-source-wins rule, or automatic resolution.
- `UNKNOWN`: identity cannot be established, provenance is unknown, or there is
  insufficient evidence to assemble the proposition.

Every original contradiction ID is retained in `contradictionRefs`; every
unknown ID/reason is retained in `unknownRefs`. Missing provenance and
deterministic mismatch remain unknown. Evidence gaps can state only what is
missing (for example, “market geography evidence missing”), not what should be
built or bought.

## Corroboration use

Existing B9 corroboration may be referenced only alongside its underlying buyer
and competitor observation references. It can indicate structural agreement,
but cannot replace the two observations, create a market/search-demand fact,
erase an unknown, or resolve a contradiction. A corroboration record without
its underlying canonical references is rejected from synthesis.

## Demand integration boundary

Phase 3A may contribute its frozen demand state, canonical metric references,
and artifact lineage. It cannot become buyer, competitor, or market evidence;
search volume cannot become an attractiveness score; and demand cannot override
a Phase 3B contradiction. `VALIDATED`, `INDICATED`, `NOT_VALIDATED`, and
`UNKNOWN` retain their Phase 3A semantics.

## Lineage, independence, and deduplication

Every supporting synthesis reference follows:

```text
Synthesis Record
→ Canonical Observation Ref
→ Artifact Ref
→ SHA-256
→ Immutable Raw Evidence
```

For B9:

```text
Synthesis → Corroboration Record → Buyer + Competitor Observations
          → Separate Artifact Refs and SHAs → Immutable Raw Evidence
```

An observation ID, artifact ref, or SHA may appear only once in the structural
supporting sets. Claims sharing any of those identities are multiple claims but
not independent sources. B9 itself never adds a second count for the evidence
it references. Independence metadata records distinct artifact refs, SHAs, and
families; source-domain diversity may be required by a later proposition rule.

## Accepted input and output boundary

Accepted inputs are stored canonical Phase 3A demand records, buyer-language
observations, competitor observations, market observations, B9 records, and
their contradiction/unknown records. Raw pages, provider envelopes, raw
responses, arbitrary external data, and unproven model summaries are rejected.

Output answers only family presence, evidence/lineage, contradiction/unknown
state, corroboration references, and evidence gaps. It is not an acquisition,
recommendation, ranking, or decision layer.

## Replay

Replay consumes stored canonical records only; it performs zero source refetches
and zero provider calls. With identical inputs and injected/static generation
metadata, it must produce identical semantic output.

## Future scoring and decision firewall

Any scoring or decision layer must be separately contracted, separately tested,
and consume synthesis output without mutating canonical evidence or synthesis
lineage. It must not be added implicitly to synthesis. This contract contains
zero scoring and zero decision logic.

## Design gates for future implementation

| Gate | Acceptance rule |
| --- | --- |
| S1 | Frozen canonical inputs remain byte/field-equivalent after synthesis. |
| S2 | No family manufactures another family’s evidence. |
| S3 | Proposition identity uses only deterministic normalization and exact matching. |
| S4 | Query, language, market, and topic context remain isolated. |
| S5 | Every support reference has observation, artifact ref, and SHA lineage. |
| S6 | Shared observation ID, artifact ref, or SHA is deduplicated as one independent source. |
| S7 | B9 references underlying buyer/competitor evidence and never replaces it. |
| S8 | Unresolved contradictions propagate without automatic resolution. |
| S9 | Unknowns and provenance failures remain explicit. |
| S10 | No numeric, weighted, or opportunity score exists. |
| S11 | No build/test/avoid or equivalent decision exists. |
| S12 | Replay makes zero refetch/provider calls and is semantically deterministic. |
| S13 | Buyer, competitor, market, B9, Phase 3A, and Phase 2 regressions remain green. |
| S14 | Output is limited to structural evidence assembly and evidence gaps. |

## Deterministic fixture plan

Future tests must cover:

1. all four families present, deterministic identity, no contradiction →
   `ASSEMBLED`;
2. buyer + competitor + B9, market unknown → `PARTIAL`;
3. demand-only, buyer-only, competitor-only, and market-only → `PARTIAL` or
   `UNKNOWN`, never an opportunity conclusion;
4. wrong market/language/query context → excluded;
5. same artifact/SHA reused across families → independence rejected;
6. unresolved contradiction → `CONTRADICTED` with all refs retained;
7. unknown provenance and deterministic mismatch → `UNKNOWN`;
8. B9 record missing underlying refs → rejected;
9. replay → zero calls and identical semantics; and
10. attempted opportunity-score or build-verdict fields → contract violation.

## Smallest implementation slice

Implement one canonical synthesis assembler only. It accepts stored canonical
records and returns one `EvidenceSynthesisRecord` for an exact proposition and
context. It adds no acquisition, schema migration (unless implementation
requires a separate approved version), UI, score, ranking, recommendation, or
business decision.

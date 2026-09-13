# Phase 3B implementation plan and acceptance gates

## Scope of this pass

This plan operationalizes the frozen [Phase 3B contract](PHASE-3B-CONTRACT.md).
It is not production implementation. Phase 3A keyword-metric acquisition and
demand qualification remain frozen and independent.

## Canonical observation definitions

The implementation must use provider-neutral records. Each record has its own
identity and preserves the source evidence rather than replacing it.

| Record | Required domain fields | Required conclusion limits |
| --- | --- | --- |
| `BuyerLanguageObservation` | exact `text`, `signalKind` (`PAIN`, `TASK`, `DESIRED_OUTCOME`, `CONSTRAINT`, `FRUSTRATION`, `COMPARISON_NEED`, `PURCHASE_CONSIDERATION`), `speakerOrContext`, `directlyObserved` | It is an observed phrase, not a demand or willingness-to-pay assertion. |
| `CompetitorValidationObservation` | verified-or-unknown competitor identity, `claimKind`, bounded `observedValue`, capture context | It is a claim about an observed offering, not a claim of competitor success or market share. |
| `MarketContextObservation` | `contextKind`, bounded observation, population scope, collection method | It is context, not market size or validated demand. |
| `CorroborationAssessment` | bounded claim, supporting refs, limiting refs, independence determination, conclusion | `SUPPORTED` is not a business-opportunity score. |
| `ContradictionRecord` | claim, supporting refs, conflicting refs, status, notes, next action | Conflicts remain visible. |
| `UnknownRecord` | topic, reason, refs, next action | Unknown does not become a negative or positive conclusion. |

## Accepted and rejected sources

| Source class | Acceptance | Conditions |
| --- | --- | --- |
| User/operator supplied statement | Accepted as `USER_PROVIDED` | Preserve who supplied it and do not represent it as independently verified. |
| Captured first-party customer/review/community content | Accepted as `SITE_OBSERVED` | Preserve exact bounded text, page identity, capture, and artifact lineage. |
| Captured competitor product or pricing page | Accepted as `COMPETITOR_OBSERVED` or `SITE_OBSERVED` | Competitor URL/domain identity must be verified before attribution. |
| Search-system observation | Accepted as `SEARCH_OBSERVED` | It supplies search context only; never buyer confirmation or demand validation. |
| Provider metric | Accepted as `PROVIDER_METRIC` | Phase 3A semantics only; it cannot satisfy Phase 3B corroboration independently. |
| Deterministic derivation | Accepted as `DERIVED` | Cite inputs and deterministic rule; cannot be sole positive evidence. |
| Model output | Accepted only as `MODEL_INFERRED` candidate | Cannot corroborate, validate, or resolve a claim. |
| Anonymous, untraceable, wrapper-only, or secret-bearing material | Rejected | Record an unknown/rejection reason rather than making an observation. |

## Required provenance envelope

Every accepted Phase 3B observation must contain:

- stable observation ID and observation kind;
- evidence category and evidence function;
- source identity and retrieval context;
- captured-at timestamp;
- source observation ID and capture ID;
- immutable artifact reference and SHA-256 for captured source material;
- direct/derived/model status and, when derived, all input references and rule
  version;
- explicit limits on what the observation can establish.

No authorization value, cookie, API key, credential, or equivalent secret may
be included in an artifact metadata field or fixture.

## Contradiction, unknown, and corroboration rules

1. A claim with material supporting and conflicting evidence produces both a
   `ContradictionRecord` and the underlying observations; neither is discarded.
2. Missing, unverifiable, or out-of-scope information produces an
   `UnknownRecord` with a deterministic next validation action.
3. A corroboration assessment needs at least two source observations whose
   independence is explicitly assessed. Reposts, syndicated pages, an identical
   provider payload, or an LLM restatement are not independent corroboration.
4. `SUPPORTED`, `MIXED`, and `INSUFFICIENT` are evidence states, not scores.
5. No contradiction resolver may delete source observations or transform an
   unresolved contradiction into a favorable conclusion.

## Phase 3A non-substitution checks

The implementation and tests must prove all of the following:

- Buyer, competitor, and market evidence cannot produce Phase 3A
  `DemandState.VALIDATED`.
- Phase 3A `PROVIDER_METRIC` evidence alone cannot produce Phase 3B
  `SUPPORTED` corroboration.
- Search appearance, SERP competitors, and keyword volume retain their existing
  meanings and do not imply buyer pain, willingness to pay, or market size.
- Phase 3B observations cannot alter canonical keyword metric observations,
  demand qualification, or provider selection/fallback behavior.

## Deterministic fixtures

Before production code, add fixtures that model these cases without any network
or live provider call:

1. a captured buyer phrase with artifact ref/SHA and a canonical `PAIN` record;
2. a source with missing lineage, rejected into an unknown record;
3. two independent buyer observations that support a bounded phrase-level claim;
4. conflicting buyer observations preserved in an open contradiction;
5. opaque competitor wrapper identity, recorded as unknown rather than attributed;
6. a Phase 3A positive-volume fixture that cannot validate Phase 3B
   corroboration; and
7. a model-generated candidate that cannot become direct or corroborating
   evidence.

Fixtures must be deterministic, contain no credentials, and make zero provider,
R2, or OpenSERP calls.

## Implementation freeze gates

| Gate | Requirement |
| --- | --- |
| B1 | Canonical buyer, competitor, and market observation types preserve category, function, source, capture, artifact ref, and SHA lineage. |
| B2 | Accepted source classes are admitted only with required provenance; rejected classes create no positive observation. |
| B3 | Captured-source bytes are persisted and hashed before canonicalization. |
| B4 | Missing or invalid provenance creates an unknown/rejection outcome and no canonical positive observation. |
| B5 | Buyer-language text remains bounded to source text and retains direct/derived/model status. |
| B6 | Competitor identity is attributed only with verified usable destination identity. |
| B7 | Contradictory source observations remain separately represented with an `OPEN`, `RESOLVED`, or `INSUFFICIENT_EVIDENCE` record. |
| B8 | Unknowns carry a reason, lineage where available, and next validation action. |
| B9 | Corroboration rejects same-source, syndicated, derived-only, and model-only pairs as independent support. |
| B10 | No Phase 3B path validates Phase 3A demand or changes keyword-metric semantics. |
| B11 | No Phase 3A metric-only path creates a Phase 3B supported buyer/competitor/market conclusion. |
| B12 | Deterministic fixtures execute with zero live provider, R2, and OpenSERP calls. |
| B13 | No opportunity score, recommendation, or final business-decision integration exists. |
| B14 | TypeScript and Phase 1/2/3A regressions remain green before a Phase 3B freeze. |

## First implementation slice

Implement only one buyer-language path:

`captured raw source -> immutable artifact + SHA -> BuyerLanguageObservation -> provenance validation -> contradiction/unknown output`

The slice may use an injected deterministic raw source fixture. It must not add
competitor acquisition, market acquisition, opportunity scoring, report-schema
integration, or final business-decision integration. The initial tests must
cover the accepted captured phrase, missing-lineage rejection, and a retained
contradiction or unknown outcome.

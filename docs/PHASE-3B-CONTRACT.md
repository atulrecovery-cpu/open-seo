# Phase 3B contract: independent validation evidence

## Status and boundary

This is a frozen design contract for Phase 3B. It introduces no provider,
acquisition flow, report-schema version, automatic opportunity score, or change
to Phase 3A keyword-metric semantics.

Phase 3A and Phase 3B answer different questions:

| Layer | Claim it may support | Claim it must not manufacture |
| --- | --- | --- |
| Phase 3A search-demand evidence | A qualifying metric supports search demand for a precise query, market, and language. | Buyer pain, willingness to pay, competitor fit, or a business opportunity. |
| Phase 3B independent validation evidence | Observed buyer language, competitor offerings, and market context. | Search demand, revenue, market size, willingness to pay, or an opportunity score. |

Neither layer silently substitutes for the other. A report must preserve their
separate observations, sources, and conclusion labels.

## Evidence categories and functions

Every Phase 3B observation retains one existing evidence category and exactly
one evidence function:

| Function | Accepted categories | Meaning |
| --- | --- | --- |
| `BUYER_LANGUAGE` | `USER_PROVIDED`, `SITE_OBSERVED`, `SEARCH_OBSERVED`, `COMPETITOR_OBSERVED` | Verbatim phrasing of a pain, task, desired outcome, constraint, comparison, or purchase consideration. |
| `COMPETITOR_OFFERING` | `SITE_OBSERVED`, `COMPETITOR_OBSERVED` | A real product or service’s observed positioning, feature, promise, price, target user, or commercial model. |
| `MARKET_CONTEXT` | `SITE_OBSERVED`, `COMPETITOR_OBSERVED`, `SEARCH_OBSERVED`, `PROVIDER_METRIC` | Observable category presence, supplier density, localization, or other bounded market context. |
| `DERIVED_CORROBORATION` | `DERIVED` | A deterministic relation among explicitly cited source observations. |
| `MODEL_CANDIDATE` | `MODEL_INFERRED` | A hypothesis or proposed research target only. |

`UNKNOWN` is permitted only for an explicit unknown record; it is never an
accepted source for a positive claim. `DERIVED` and `MODEL_INFERRED` records
must cite their inputs and cannot be the sole support for a validated claim.

## Source acceptance rules

An accepted source must have an immutable capture or user-supplied source
reference, capture time, source identity, retrieval context, evidence category,
and an artifact reference plus SHA-256 whenever an artifact was captured.
Credentials, authorization headers, cookies, and equivalent secrets are not
evidence and must not be stored in metadata.

Source-specific requirements:

- Buyer-language evidence retains the exact quoted or faithfully bounded text,
  the speaker/page context, and whether it is first-party, user-provided, or
  competitor-hosted. Competitor marketing copy is not treated as a buyer quote.
- Competitor evidence requires a verified usable site/page identity before
  assigning a domain or URL. Unverified destinations remain opaque and may only
  be recorded as an unknown competitor identity.
- Pricing requires the observed price, currency, billing basis, availability
  context, and capture time. Missing or ambiguous pricing becomes unknown.
- Market-context evidence records the observed population and collection method;
  a small or convenience sample must not be labeled market size or demand.
- Search appearance and competitor presence are contextual observations, not
  demand validation.

## Canonical observation contract

Implementation may add provider-neutral types only after this contract is
reviewed. The minimum canonical records are:

| Type | Required fields |
| --- | --- |
| `BuyerLanguageObservation` | `id`, verbatim `text`, `signalKind` (pain/task/outcome/constraint/comparison/purchase consideration), `speakerOrContext`, `source`, `evidenceFunction`, `evidenceRefs` |
| `CompetitorValidationObservation` | `id`, `competitorIdentity` (verified or unknown), `claimKind` (product/service/pricing/positioning/feature/promise/target user), `observedValue`, `source`, `evidenceFunction`, `evidenceRefs` |
| `MarketContextObservation` | `id`, `contextKind` (commercial presence/category maturity/supplier density/demand context), `observedValue`, `populationScope`, `source`, `evidenceFunction`, `evidenceRefs` |
| `CorroborationAssessment` | `id`, bounded `claim`, supporting and limiting evidence refs, independence assessment, conclusion (`SUPPORTED`, `MIXED`, `INSUFFICIENT`), and explicit limits |
| `ContradictionRecord` | bounded claim, supporting refs, conflicting refs, status, notes, and required next validation action |
| `UnknownRecord` | topic, reason, evidence refs, and next validation action |

All records preserve source category and lineage. No record may infer a verified
competitor identity from an opaque redirect or wrapper.

## Corroboration and contradiction policy

Independent corroboration means the supporting sources are not merely two
representations of the same provider response, page, author, or syndicated
content. The assessment records the basis for independence and any uncertainty.

Conflicting evidence is retained, never majority-voted away. A contradiction is
`OPEN` until a higher-quality or more directly relevant observation resolves it;
otherwise it is `INSUFFICIENT_EVIDENCE`. Unknowns are first-class outputs and
must lead to a research action rather than a favorable assumption.

## Business-opportunity conclusion boundary

Phase 3B may strengthen a bounded conclusion only when it has direct,
lineage-backed evidence relevant to that conclusion and records its limits.
For example, it may support: "observed competitors position tools for this
task" or "observed buyer language includes comparison phrasing."

Phase 3B may not conclude that an opportunity is commercially validated, that
buyers will pay, or that a market is large. It may not turn `INDICATED`,
`NOT_VALIDATED`, or `UNKNOWN` Phase 3A demand into `VALIDATED`. A business
opportunity remains a research hypothesis until a later, separately approved
policy defines its evidence threshold and scoring behavior.

## Out of scope

- Keyword-metric provider acquisition, normalization, or demand qualification.
- Automatic opportunity scoring, ranking, or recommendation generation.
- Redirect resolution or relaxation of Phase 1 destination safeguards.
- Changes to frozen schemas v1 or v1.1.
- Live provider, R2, or OpenSERP calls during the design pass.

## Exit criteria for this design pass

Phase 3B implementation may begin only after review accepts these canonical
records, source acceptance rules, contradiction handling, and the non-
substitution boundary with Phase 3A.

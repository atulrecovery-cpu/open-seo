# Phase 1.8 implementation

Implemented a test-only-ready provider-neutral SERP boundary without changing DataForSEO behavior.

| Deliverable | Location |
|---|---|
| Canonical request, observation, capability and error types | `src/server/lib/serp-providers/types.ts` |
| Content-addressed immutable R2 evidence store | `src/server/lib/serp-providers/evidence.ts` |
| Experimental OpenSERP adapter | `src/server/lib/serp-providers/openserp.ts` |
| Fixture-backed safety tests | `src/server/lib/serp-providers/openserp.test.ts` |

Acceptance policy: OpenSERP is non-default; explicit device requests reject; redirect-wrapper destination identities are nulled and flagged unusable; there is no fallback. The adapter does not decode/follow redirects or modify `src/server/lib/dataforseo/serp.ts`.

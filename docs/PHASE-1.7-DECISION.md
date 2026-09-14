# Phase 1.7 decision

## Decision: B — OpenSERP as experimental fallback

OpenSERP is source- and runtime-verified as a basic Google organic SERP acquisition candidate. It supplies the request/envelope/provenance primitives needed for a test-only adapter and can preserve raw provider evidence before normalization. It cannot yet be a primary rank-tracking replacement: there is no explicit device request dimension, locale semantics need provider policy, and the verified Google runtime returned redirect URLs/domain `google.com` rather than destination targets.

The right next architecture remains a **multi-provider SERP abstraction**, but production implementation should begin in experimental/fallback mode until destination normalization and desktop/mobile policy are proven with controlled fixtures and tests.

## Smallest production implementation next phase

Add a test-covered, non-default `OpenSerpSerpAdapter` behind a new internal SERP acquisition port. It must accept the draft canonical request, write immutable raw evidence before parsing, normalize only organic rank/title/snippet, and reject redirect-wrapper rows for target-domain rank tracking. Do not modify `src/server/lib/dataforseo/serp.ts` or switch existing traffic until this adapter’s fixtures cover destination URLs, country/language mapping and device behavior.

# OpenSERP destination identity decision

## Evidence examined

At OpenSERP commit `29c7b0fbe09640160efcfc1f1e04e60e0fbe60e9`, `google/search.go` obtains an organic result's `href` directly from the result-link element and assigns it to `SearchResult.URL`. There is no organic-web URL unwrapping or independently supplied destination field. `google/search_raw.go` follows the same direct-href pattern. The image-only `imgrefurl` parser in `google/url.go` is not applicable to web organic results.

The bounded 2026-09-13 Google runtime response contained `https://www.google.com/goto?...` and `domain: google.com` for organic rows. The wrapper payload was opaque; no destination URL or destination-domain field was independently confirmed.

## Deterministic classification

| Input | Identity state | URL/domain available for matching |
|---|---|---|
| Direct provider HTTP(S) href that parses successfully | `VERIFIED_DESTINATION` | Yes; URL is canonicalized (fragment removed), hostname lower-cased and a trailing hostname dot removed. Subdomains are retained. |
| Google `/goto` URL, including a `url` parameter that appears decodable | `WRAPPER_ONLY` | No |
| Missing, malformed, or non-HTTP(S) direct href | `UNVERIFIED_DESTINATION` | No |

No wrapper candidate is decoded, inferred, fetched, or promoted to `VERIFIED_DESTINATION`. A value from a redirect query parameter would be a candidate only and has no independent evidence in the OpenSERP response.

## Decision

**D1 — OpenSERP Google wrapper destinations are not recoverable from the validated evidence without fetching.** Destination URL/domain matching is allowed only for direct canonical HTTP(S) hrefs. Wrapper-only records remain available through their raw evidence artifact for audit, but cannot enter rank matching.

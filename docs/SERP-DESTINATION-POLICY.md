# SERP destination and domain policy

1. Raw provider bytes are evidence, not trusted destination identity.
2. A destination is matchable only when the provider presents a direct HTTP(S) href that parses deterministically. The canonical form removes fragments; domain is the lower-case hostname with a single trailing dot removed. Ports, path, query, and subdomains are preserved by URL parsing.
3. Redirectors, wrapper URLs, opaque links, missing links, malformed links, and non-HTTP(S) schemes are never decoded, fetched, or inferred. Their destination URL/domain are `null` for matching.
4. Only `VERIFIED_DESTINATION` plus a usable normalized domain may enter target-domain rank matching. `WRAPPER_ONLY` and `UNVERIFIED_DESTINATION` are excluded.
5. This policy does not change the existing DataForSEO path or establish cross-provider equivalence.

# Phase 1.9 decision

## Scope and bounded activity

No new upstream OpenSERP search request was executed. This phase used the already-recorded bounded Google runtime observation and source at OpenSERP commit `29c7b0fbe09640160efcfc1f1e04e60e0fbe60e9`. No redirect fetch, browser navigation, or wrapper decoding was introduced.

## Decisions

- **Destination: D1.** Google `/goto` wrapper results cannot yield verified destination URL/domain under the available evidence. Direct provider HTTP(S) hrefs are normalized deterministically; wrapper, malformed, and non-HTTP(S) records are unusable for matching.
- **Device: V3.** The default profile catalog has no confirmed mobile profile, and the API has no per-request device contract or response echo. Device-specific requests remain rejected.

## Gates

| Gate | Result |
|---|---|
| A: source/runtime identity evidence recorded | Pass |
| B: wrapper handling bounded and deterministic | Pass |
| C: no candidate promoted without independent evidence | Pass |
| D: unsafe identity blocked from rank matching | Pass |
| E: direct canonical identity has explicit normalization policy | Pass |
| F: device capability state matches source evidence | Pass |
| G: device-specific requests reject | Pass |
| H: DataForSEO behavior remains isolated | Pass |

## Readiness

**R2 — safe to freeze, experimental and limited.** OpenSERP remains non-default, has no automatic fallback, is not approved for canonical device-specific rank tracking, and wrapper-only Google results cannot participate in target-domain matching. The Phase 1.9 boundary is safe precisely because unsupported claims are rejected rather than inferred.

## Phase 2 recommendation

Evaluate a provider/runtime that returns an independently evidenced final destination and has an explicit, echoed per-request device contract. Only then consider a separate, gated rank-tracking integration experiment.

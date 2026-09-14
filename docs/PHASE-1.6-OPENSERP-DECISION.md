# Phase 1.6 OpenSERP decision

## Evidence result

OpenSERP source, configuration, API schema and runtime were not accessible in the available workspace roots. No external request was issued. Consequently, its engine, locale, device, pagination, organic rank, PAA, related-search, error, timeout, timestamp and raw-response support are all **unverified**.

## Replacement scope

| Capability                                          | Finding                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Basic organic SERP retrieval                        | UNKNOWN                                                            |
| Rank observation                                    | UNKNOWN                                                            |
| People Also Ask                                     | UNKNOWN                                                            |
| Related searches                                    | UNKNOWN                                                            |
| Localized SERPs                                     | UNKNOWN                                                            |
| Device-specific SERPs                               | UNKNOWN                                                            |
| Search volume / CPC / competition                   | NO EVIDENCE OF REPLACEMENT; these are separate DataForSEO datasets |
| Backlinks / historical keyword data / AI visibility | NO EVIDENCE OF REPLACEMENT; outside basic SERP acquisition         |

## Architecture option assessment

| Option                                                       | Vendor independence | Complexity | Reliability/evidence                        | Decision                                |
| ------------------------------------------------------------ | ------------------- | ---------- | ------------------------------------------- | --------------------------------------- |
| A. DataForSEO only                                           | Low                 | Low        | Known current behavior, weak raw provenance | Current baseline only                   |
| B. OpenSERP only                                             | Unknown             | Unknown    | Cannot assess without contract/runtime      | Reject for now                          |
| C. Hybrid, OpenSERP basic SERP + DataForSEO proprietary data | Potentially medium  | Medium     | Conditional on verified parity/operations   | Candidate after evidence                |
| D. Multi-provider SERP port                                  | High potential      | Higher     | Best future isolation, but premature        | Defer until one alternative is verified |

Open-source acquisition is not automatically cheaper or safer: a valid decision must account for CAPTCHA/blocking, proxy/infrastructure cost, parser maintenance, search-engine changes, locale accuracy and availability. None can be evaluated for OpenSERP without its source/runtime contract.

## Decision gate

**E — INSUFFICIENT EVIDENCE.** Do not integrate OpenSERP, add a fallback, or implement a provider port in Phase 1.7 yet.

## Exact smallest Phase 1.7 step

Place a verified OpenSERP checkout or its authoritative API schema/runtime endpoint inside an accessible workspace, then run exactly one first-page Google query (`best accounting software for small business`) with one language/region/device. Store the redacted request, raw response, HTTP/status, SHA-256 and parsed organic rows as a test artifact; compare only against the requirements in `OPENSERP-CONTRACT-MATRIX.md`. No production code change is authorized by that step.

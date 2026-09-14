# Verified OpenSERP–OpenSEO compatibility

## Source evidence

OpenSERP `docs/openapi.yaml` defines `GET /{engine}/search`, engines including Google, `text`, `lang`, `region`, `limit`, `start` and `features`; the 200 schema contains query echo, `meta.request_id`, `meta.requested_at`, `results`, `serp_features` and pagination. `core/common.go` defines `Query` and validates limit 1–100/start nonnegative; its `SearchResult` comments define `Rank` as one-based within type and `AbsoluteRank` as mixed-SERP position. `core/server.go` handles dedicated endpoints; `google/search.go` implements Google collection. `core/region/region.go` resolves a free-text region hint per engine. These are source-verified; runtime evidence is in `OPENSERP-RUNTIME-VALIDATION.md`.

## Mapping decision

| Canonical Concept             | OpenSEO Requirement                 | DataForSEO Representation       | OpenSERP Representation           | Mapping                       | Evidence                                                         |
| ----------------------------- | ----------------------------------- | ------------------------------- | --------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| Query                         | Required                            | `keyword`                       | `query.text` / `text`             | DIRECT                        | Source + runtime                                                 |
| Google engine                 | Required                            | path `/serp/google/...`         | `/google/search`, result `engine` | DIRECT                        | Source + runtime                                                 |
| Language                      | Required                            | `language_code`                 | `lang` hint / query echo          | TRANSFORMABLE                 | Source + runtime; normalize codes/casing                         |
| Region                        | Required                            | location code/name              | `region` free-text hint           | POLICY REQUIRED               | Source + runtime; semantics are not identical                    |
| Device                        | Required for rank tracking          | `device` desktop/mobile         | no device query field             | MISSING                       | Source-verified `Query` fields                                   |
| Coverage                      | Required                            | `depth` 10–100                  | `limit` 1–100 and `start` offset  | TRANSFORMABLE                 | Source + runtime                                                 |
| Organic classification        | Required                            | `type: organic`                 | `type: organic`                   | DIRECT                        | Source + runtime                                                 |
| Organic rank                  | Required                            | `rank_group`, absolute fallback | `rank`; `position.absolute`       | POLICY REQUIRED               | Source + runtime; rank is documented type-local, matching intent |
| URL                           | Required for match/output           | `url`                           | `url`                             | LOSSY in tested Google result | Runtime returned Google redirect wrappers                        |
| Domain                        | Required for target-domain matching | `domain`                        | `domain`                          | LOSSY in tested Google result | Runtime returned `google.com`                                    |
| Title/snippet                 | Enrichment                          | `title`/`description`           | `title`/`snippet`                 | DIRECT                        | Source + runtime                                                 |
| Features/PAA/related          | Enrichment                          | item types                      | `serp_features`                   | TRANSFORMABLE                 | Source schema; runtime verified `ai_summary`, not PAA/related    |
| Pagination                    | Optional today                      | depth/task semantics            | page/has_more/next_start          | TRANSFORMABLE                 | Source + runtime                                                 |
| Provider/timestamp/request ID | Future provenance                   | provider task metadata          | meta + header                     | DIRECT                        | Source + runtime                                                 |
| Raw response                  | Future provenance                   | only in memory today            | direct JSON response              | DIRECT                        | Runtime                                                          |

## Localisation and rank decision

OpenSERP accepts language and free-text region hints, with engine-specific resolution. This is **USABLE WITH POLICY**, not a strong DataForSEO-location match: OpenSEO must define canonical country/locale values and provider mappings; city-level and proxy behavior require per-engine policy. The runtime US/EN test proves parameter acceptance, not equivalence to DataForSEO’s location codes.

Organic position is **SAFE WITH ADAPTER POLICY** for position semantics: OpenSERP’s type-local, one-based `rank` aligns with OpenSEO’s preference for `rank_group` (organic-only rank), while `position.absolute` must remain separate. It is not safe to enable current domain rank tracking with the tested Google output because redirect URLs/domains cannot identify the ranked target.

## DataForSEO boundary

**Candidate only:** basic Google organic acquisition, once a destination URL/domain policy and device strategy are verified.\
**Keep/likely keep:** keyword volume/CPC/competition, Labs/domain data, backlinks, historical datasets, local business data, Lighthouse and AI Optimization datasets.\
**Not decided:** PAA, related searches and full feature taxonomy; source supports feature objects but the bounded runtime observed only AI summary.

# OpenSEO capability matrix

Baseline examined at commit `7b9ee0e4fa800e5bae9ca76f49cb273a9c677204` (2026-09-13).
“Tested” means automated source tests were located; the full suite could not be run in this audit environment because the dependency installation did not complete. “Working” is therefore limited to code-path evidence, not a credentialed production claim.

| Capability | Exists | Tested | Working | Evidence | Dependency | Notes |
|---|---:|---:|---:|---|---|---|
| Keyword research / ideas / metrics | Yes | Yes | Unverified runtime | `src/server/lib/dataforseo/{labs,keyword-metrics,google-ads}.ts`; `src/routes/_project/p$projectId/keywords.tsx` | DataForSEO | Provider-backed volumes, CPC, difficulty and intent; not independently verified search behaviour. |
| SERP research / competitors / ranks | Yes | Yes | Unverified runtime | `src/server/lib/dataforseo/serp.ts`; `src/server/mcp/tools/get-serp-results.ts`; `RankCheckWorkflow.ts` | DataForSEO | Google SERP results, location/language/device inputs. |
| Rank tracking | Yes | Yes | Unverified runtime | `src/server/workflows/RankCheckWorkflow.ts`, `src/server/workflows/RankCheckWorkflow.test.ts` | DataForSEO, Cloudflare Workflows | Manual live and scheduled queued paths. |
| Domain / competitor analysis | Yes | Yes | Unverified runtime | `src/server/lib/dataforseo/labs.ts`; `src/routes/_project/p$projectId/domain.tsx` | DataForSEO Labs | Geographic availability is constrained by Labs. |
| Content gap / relevant pages | Partial | Yes | Unverified runtime | `src/server/lib/dataforseo/labs.ts`, `dataforseo-research-tools.ts` | DataForSEO Labs | Implemented as provider research data; no proprietary semantic gap engine found. |
| Backlink analysis | Yes | Yes | Unverified runtime | `src/server/lib/dataforseo/backlinks.ts`; `get-backlinks-profile.ts` | DataForSEO Backlinks API | Account must have Backlinks API enabled. |
| Local SEO / business listings | Yes | Yes | Unverified runtime | `src/server/lib/dataforseo/business.ts`; `local-seo-tools.ts` | DataForSEO Business Data | Coordinates/radius are passed to provider. |
| Site crawling / technical audit | Yes | Yes | Unverified runtime | `src/server/workflows/SiteAuditWorkflow.ts`; `src/server/lib/audit/*`; `specs/0009-site-audit-crawl-architecture.md` | Cloudflare Workers/DO; optional DataForSEO Lighthouse | Own crawler with URL policy, robots/sitemap processing and durable workflow. |
| Sitemap / robots / metadata / headings / links / schema | Yes | Yes | Unverified runtime | `src/server/lib/audit/{discovery,page-analyzer}.ts`; `src/db/audit.schema.ts` | Target site access | Crawl evidence is persisted with fetched-page attributes. |
| Core Web Vitals / Lighthouse | Yes | Yes | Unverified runtime | `src/server/lib/dataforseo/lighthouse.ts`; `lighthouseStoredPayload.ts` | DataForSEO Lighthouse | Provider report, not local Lighthouse execution. |
| Google Search Console | Yes | Yes | Unverified runtime | `src/server/lib/gscClient.ts`; `src/server/features/gsc/*`; `docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md` | Google OAuth/API | Optional; OAuth secrets required. |
| Google Analytics 4 | Yes | Yes | Unverified runtime | `src/server/lib/ga4Client.ts`; `src/server/features/ga4/*`; `docs/SELF_HOSTING_GOOGLE_ANALYTICS.md` | Google OAuth/API | Optional; OAuth secrets required. |
| Content briefs / generation / metadata generation | No dedicated workflow located | N/A | No | Routes, MCP tools and skills reviewed | — | SAM can advise through an LLM, but this is not a deterministic or dedicated content-generation product feature. |
| Internal-link analysis | Partial | Yes | Unverified runtime | `src/server/lib/audit/issues/multipage*.ts`; audit schema | Crawl | Detects link graph issues; no standalone internal-link recommendation planner found. |
| Structured schema generation | No | N/A | No | Audit parses/stores page schema evidence; no generator route/tool found | — | Do not confuse schema inspection with generation. |
| Topic / keyword clustering | Skill guidance only | N/A | No product runtime verification | `plugins/openseo/skills/keyword-clustering/SKILL.md` | Agent + research data | A skill is prompt/workflow guidance, not an implemented clustering service. |
| AI visibility: brand mentions | Yes | Yes | Unverified runtime | `src/server/features/ai-search/services/brandLookup.ts` | DataForSEO LLM Mentions | Current platform set is ChatGPT and Google AI Overview. ChatGPT data is forced to US/en. |
| AI prompt comparison | Yes | Yes | Unverified runtime | `src/server/features/ai-search/services/promptExplorer.ts`; `src/types/schemas/ai-search.ts` | DataForSEO LLM Responses | Supports configured ChatGPT, Claude, Gemini, Perplexity model requests; this is provider-mediated response data. |
| Citation / source analysis | Partial | Yes | Unverified runtime | `promptExplorer.ts`, `brandLookupShaping.ts` | DataForSEO | Extracts/render citations and top pages; no authority-scoring engine found. |
| GEO / AEO recommendations | No dedicated engine | N/A | No | AI-search service review | — | Data collection and display exist; no evidence-based recommendation/prioritization layer found. |
| SaaS opportunity discovery | No | N/A | No | Route/service review | — | Keyword/domain data can be a foundation only. |
| MCP access for agents | Yes | Yes | Unverified runtime | `src/server/mcp/server.ts`, `src/server/mcp/tools/*`, `plugins/openseo/mcp.json` | Auth + DataForSEO where applicable | Tools expose project and research operations. |

## Verification constraints

No DataForSEO, OpenRouter, Google OAuth, Cloudflare Access, or Docker credentials/services were supplied. Live paid calls and internet-facing crawling were intentionally not attempted. The locked dependency installation ultimately completed using `corepack pnpm install --frozen-lockfile`. A normal `pnpm test` run reached the suite but one OAuth setup hook exceeded Vitest's default 10-second timeout on this Windows host; the focused file passed all 8 tests with `--hookTimeout 30000`. The complete default-timeout suite must therefore not be reported as fully green.

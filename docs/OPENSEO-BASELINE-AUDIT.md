# OpenSEO baseline audit

**Audited source:** `every-app/open-seo`, commit `7b9ee0e4fa800e5bae9ca76f49cb273a9c677204` (`release: v0.1.8 (#604)`).\
**Audit date:** 2026-09-13.\
**Starting working tree:** clean on `main...origin/main`.

## 1. Executive summary

OpenSEO is a TypeScript, React and Cloudflare Workers SEO application. It is a practical foundation for provider-backed keyword/SERP/domain/backlink research, scheduled rank checking, site audits, Google integrations, an MCP server, and limited AI-search visibility. It is **not** a complete AI-powered SEO/GEO/AEO operating system: its central search-data dependency is DataForSEO, its recommendation layer is comparatively thin, it has no SaaS opportunity-discovery system, and its “AI visibility” is provider-mediated data rather than direct measurement of answer engines.

**Baseline recommendation: EXTEND / FORK HEAVILY.** Retain useful infrastructure but introduce provider-neutral evidence, cost-control and decision layers before treating it as the future platform core.

## 2. Repository architecture

See [OPENSEO-ARCHITECTURE.md](./OPENSEO-ARCHITECTURE.md). The root app is TypeScript (`package.json`, `tsconfig.json`), React/TanStack/Vite on the client (`src/client`, `src/routes`), with Cloudflare Worker entrypoints (`src/server.ts`, `src/audit-worker.ts`). Drizzle manages SQLite/D1 and Postgres schemas (`src/db`, `drizzle`, `drizzle-pg`). `pnpm@10.30.1` is pinned in `package.json`; root, `web/`, and `badseo/` are distinct pnpm projects (`pnpm-workspace.yaml`, `docs/LOCAL_DEVELOPMENT.md`).

## 3. Installation and runtime status

Documented local prerequisites are Node 20+, Corepack, a DataForSEO account, and pnpm 10.30.1 (`docs/LOCAL_DEVELOPMENT.md`, `package.json`). CI uses Node 22 (`.github/workflows/ci.yml`); Docker uses `node:22` (`Dockerfile.selfhost`).

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
# set DATAFORSEO_API_KEY (base64 login:password) and AUTH_MODE=local_noauth
pnpm run db:migrate:local
pnpm run dev
```

The audit host has Node `v24.11.1`. `corepack enable` failed with Windows `EPERM` attempting to write `C:\Program Files\nodejs\pnpm`: **PLATFORM/OS ISSUE**. `corepack pnpm` successfully selected `10.30.1`, and `corepack pnpm install --frozen-lockfile --network-concurrency=1` completed. The first test command was blocked by the Windows filesystem sandbox while esbuild loaded config; the same test was then run with the needed workspace access.

No credentials were fabricated. Therefore app startup, migration, Docker startup, paid provider calls, OAuth, and end-to-end UI flows remain **unverified**.

### Required configuration and services

| Item | Status / role | Evidence |
|---|---|---|
| `DATAFORSEO_API_KEY` | Required for SEO data; base64 `login:password` | `.env.example`, `docs/DATAFORSEO_API_KEY.md` |
| `AUTH_MODE=local_noauth` | Local trusted mode; Docker forces this mode | `.env.example`, `compose.yaml` |
| `PORT` | Optional, default 3001 Docker | `.env.example`, `compose.yaml` |
| D1 | Default database; local migrations use Wrangler | `wrangler.jsonc`, `docs/LOCAL_DEVELOPMENT.md` |
| Postgres | Optional scaling backend | `docs/LOCAL_POSTGRES.md`, `src/db/pg/**` |
| `OPENROUTER_API_KEY` | Optional generally; required for SAM | `.env.example`, `src/server/lib/openrouter.ts` |
| Google OAuth credentials / Better Auth secret | Required only for GSC/GA4 and hosted mode | `.env.example`, `docs/SELF_HOSTING_GOOGLE_*` |
| Cloudflare Access config | Required for default protected deployment | `.env.example`, `src/lib/auth-mode.ts` |

Deployment paths are Cloudflare/Alchemy (`alchemy.run.ts`, `wrangler.jsonc`) and Docker Compose (`compose.yaml`, `Dockerfile.selfhost`). Production scripts are `deploy`, `deploy:selfhost`, `deploy:postgres`; build is `pnpm build`; preview is `pnpm preview` (`package.json`).

## 4. Tests and capability status

The project contains Vitest unit tests across schemas, provider clients, audit logic, workflows, services and MCP tools, plus Playwright E2E tests under `e2e/`; CI runs formatting, knip, TypeScript, oxlint, tests, build, website checks and Docker build (`package.json`, `.github/workflows/ci.yml`). `pnpm test` exercised the suite but had one failure: `src/server/mcp/oauth-refresh.e2e.test.ts` exceeded Vitest's default 10-second hook timeout. A focused retry with `pnpm exec vitest run src/server/mcp/oauth-refresh.e2e.test.ts --hookTimeout 30000` passed 8/8 in 7.61 seconds, which identifies a host-sensitive timeout rather than a reproduced OAuth assertion defect. A complete default-timeout test run is **not green**. Playwright, Docker, migrations, live app startup and paid functional tests were not run. Capability-by-capability evidence is in [OPENSEO-CAPABILITY-MATRIX.md](./OPENSEO-CAPABILITY-MATRIX.md).

## 5. SEO intelligence and decision logic

Search data flows through `src/server/lib/dataforseo/**`; it covers Labs/domain data, Google Ads keyword data, Google SERPs, Backlinks, Business Data, DataForSEO Lighthouse, and LLM APIs. `RankCheckWorkflow.ts` handles live/manual versus queued/scheduled rank checks. `SiteAuditWorkflow.ts` coordinates a native crawler/page analyzer and optional provider Lighthouse.

There are deterministic checks and scores: crawl issue reporters (`src/server/lib/audit/issues/**`), audit limits (`src/shared/audit-limits.ts`), rank-cost estimates (`src/shared/rank-tracking.ts`), input/market validation (`src/shared/researchScope.ts`, `keyword-locations.ts`), and billing metering. The audit did **not** find a cross-feature opportunity score, deterministic content-gap ranker, or priority engine converting all collected SEO evidence into a unified recommendation backlog. LLM prose in SAM is not a deterministic algorithm.

## 6. Data/evidence and AI-agent assessment

The detailed data-flow and agentic classification are in [OPENSEO-ARCHITECTURE.md](./OPENSEO-ARCHITECTURE.md). The important finding is provenance is feature-local rather than universal. Provider rows, audit rows, timestamps and R2 caches exist, but a future system should preserve canonical raw source artifacts, request parameters, capture timestamps, normalized claims and recommendation lineage. Do not present SAM-generated narrative as observed evidence unless it cites the underlying tool/source rows.

SAM is agentic in the narrow, real sense: a Cloudflare Think Durable Object invokes project-scoped MCP tools in a multi-step loop, has persisted conversation/project context, compaction, authorization, usage metering and limits (`SamChatAgent.ts`). It has no human-approval step for every paid tool invocation; hosted credit checks limit spend but a user-facing cost-confirmation policy should be added before high-cost work.

## 7. International, GEO and AEO readiness

International traditional SEO is a viable extension: market/language mappings and validations are explicit (`src/shared/keyword-locations.ts`) and hreflang is collected during auditing. It remains provider coverage dependent. No full multilingual content/localization system exists.

**Currently implemented:** DataForSEO LLM Mentions brand lookup for ChatGPT and Google AI Overview (`brandLookup.ts`), and prompt response comparison for configured ChatGPT, Claude, Gemini and Perplexity models (`promptExplorer.ts`). Citation extraction is present. ChatGPT mention data is hard-coded to US/en in the brand lookup service.

**Possible extension, not implemented:** direct answer-engine capture/comparison, citation-gap/authority scoring, AI answer replay history, source-authority analysis, answer optimization recommendations, and cross-market answer-engine monitoring.

## 8. Fit for SaaS opportunity discovery

The keyword, SERP, competitor, crawl, GSC/GA4, caching, project context and MCP layers are useful foundations. Nothing discovered turns long-tail queries, pains/jobs, SERP weakness, monetization potential and product feasibility into a SaaS opportunity. That must be a new evidence-backed decision pipeline rather than an LLM prompt layered on current screens.

## 9. Reuse versus replace

| Module | Classification | Reason | Risk | Recommended future action |
|---|---|---|---|---|
| UI/routes | EXTEND | Modern functional product surface | UX tied to current workflows | Retain patterns, redesign later only after evidence model. |
| DataForSEO client | WRAP | Useful mature acquisition seam | Single-vendor data/cost lock-in | Define provider-neutral interfaces and preserve raw responses. |
| Site audit crawler | EXTEND | Native crawl/issue foundation | Worker limits and URL-fetch risk | Add explicit crawl budgets, replay/provenance and worker isolation. |
| Rank workflow | EXTEND | Durable scheduling/batch patterns | Provider-specific and cost-sensitive | Keep workflow contract; abstract rank source. |
| D1/Postgres repositories | KEEP | Dual-backend persistence is useful | Schema duplication drift | Consolidate shared migrations/testing incrementally. |
| SAM / MCP | WRAP | Useful agent access and tool contracts | Prompt injection, opaque narrative, autonomous paid calls | Put policy, evidence citations and approval gates in front of tools. |
| AI visibility services | EXTEND | Good provider-mediated baseline | Not direct answer-engine truth; partial geography | Add capture provenance and additional providers. |
| Billing/telemetry | EXTEND | Existing cost seams | Hosted/vendor assumptions | Adopt budgets/quotas per organization, project, workflow. |
| SaaS discovery | REPLACE / NEW | Not present | False inference from SEO metrics | Design independently after baseline. |

## 10. Security, costs and technical debt

Security positives include target URL policy tests (`src/server/lib/audit/url-policy.test.ts`), validation with Zod, Cloudflare Access/Better Auth modes, cost estimates and cache controls. Main risks:

- Crawling and generic fetch capabilities remain SSRF/egress-risk surfaces; verify `url-policy.ts` against DNS rebinding, redirects and private ranges under deployed Workers conditions.
- SAM processes user/site/tool content and can be prompt-injected; tool scopes do not make model output trustworthy.
- DataForSEO/OpenRouter costs are variable and paid calls can be amplified by deep SERPs, large rank batches, AI fan-out and crawls. Limits and hosted credit checks exist but no comprehensive pre-execution approval policy was found.
- Docker self-hosting deliberately uses `local_noauth`; exposing it without an authenticated proxy is unsafe (`docs/SELF_HOSTING_DOCKER.md`, `compose.yaml`).
- Dependencies must be scanned after install; no vulnerability scan was completed here.

Cost categories: **free/open source:** application code, React, TanStack, Drizzle, Vite and local development tools. **Required paid/credentialed for core SEO data:** DataForSEO. **Optional paid/credentialed:** OpenRouter for SAM, Cloudflare deployment resources/Access depending on plan, Google integration setup, hosted Autumn/PostHog/Loops/Dub integrations. **Variable use:** DataForSEO endpoint/crawl/Lighthouse/AI requests and OpenRouter tokens. No price claim is made because no current price verification was performed.

Technical debt: provider-centric domain models, source/provenance gaps, D1/Postgres duplication, Cloudflare runtime coupling, feature-local prioritization, and external-service-heavy local reproducibility.

## 11. Strengths, limitations and next phase

**Strengths:** actively structured TypeScript code; clear workflows; real tests; D1/Postgres scale path; guarded paid API use; strong MCP/SAM integration; native audit engine; explicit international provider validation.

**Major limitations / top five gaps:**

1. No provider-neutral evidence/provenance and replay layer.
2. DataForSEO is a critical single paid dependency.
3. No unified evidence-to-priority/recommendation engine.
4. AI visibility is partial provider data, not comprehensive answer-engine monitoring.
5. No SaaS opportunity discovery, commercial-potential model, or automated execution loop.

**Exact recommended next step:** finish a clean locked dependency install on Node 22, create a local non-production `.env.local` with a real DataForSEO credential and `AUTH_MODE=local_noauth`, run `db:migrate:local`, `test`, `build`, and a narrow controlled smoke test against a user-owned test domain. Record raw request/response metadata and actual results before authorizing any architectural change.

## 12. Completion record

- Starting commit: `7b9ee0e4fa800e5bae9ca76f49cb273a9c677204`
- Current commit: unchanged at audit time
- Files added: this report, `OPENSEO-CAPABILITY-MATRIX.md`, `OPENSEO-ARCHITECTURE.md`
- Installation: passed with `corepack pnpm` workaround; global Corepack enable remains blocked by Windows permissions
- Runtime: unverified (credentials/services absent)
- Tests: default suite not green (one 10-second OAuth setup-hook timeout); focused retry passed 8/8 with a 30-second hook timeout
- Paid requirement: DataForSEO for core SEO-data functions; OpenRouter for SAM

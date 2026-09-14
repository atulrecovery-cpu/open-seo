import { describe, expect, it } from "vitest";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";
import type { KeywordMetricRawTransport } from "@/server/lib/keyword-metrics/dataforseo-transport";
import { createKeywordResearchRunService } from "./KeywordResearchRunService";
import type {
  KeywordResearchRun,
  KeywordResearchRunSummary,
  PersistedKeywordResearchObservation,
} from "./keywordResearchRunTypes";

function fixture(payload: unknown) {
  let providerCalls = 0;
  let artifactCalls = 0;
  let nextId = 0;
  const runs = new Map<string, KeywordResearchRun>();
  // Mirrors the mutable saved-keyword cache boundary without letting it enter
  // the run repository.
  const keywordMetricsCache = new Map<string, unknown>();
  const repository = {
    async create(
      input: Omit<
        KeywordResearchRunSummary,
        | "status"
        | "failureCode"
        | "failureArtifactRef"
        | "failureArtifactSha256"
        | "completedAt"
      >,
    ) {
      runs.set(input.id, {
        ...input,
        status: "PENDING",
        failureCode: null,
        failureArtifactRef: null,
        failureArtifactSha256: null,
        completedAt: null,
        observations: [],
      });
    },
    async complete(
      run: KeywordResearchRun,
      observations: PersistedKeywordResearchObservation[],
    ) {
      runs.set(run.id, structuredClone({ ...run, observations }));
    },
    async fail(
      runId: string,
      code: string,
      artifact: { ref: string; sha256: string } | null,
      completedAt: string,
    ) {
      const run = runs.get(runId)!;
      runs.set(runId, {
        ...run,
        status: "FAILED",
        failureCode: code,
        failureArtifactRef: artifact?.ref ?? null,
        failureArtifactSha256: artifact?.sha256 ?? null,
        completedAt,
      });
    },
    async get(projectId: string, id: string) {
      const run = runs.get(id);
      return run?.projectId === projectId ? structuredClone(run) : null;
    },
    async list(projectId: string) {
      return [...runs.values()]
        .filter((run) => run.projectId === projectId)
        .map(({ observations: _observations, ...run }) => structuredClone(run));
    },
  };
  const transport: KeywordMetricRawTransport = {
    execute: async () => {
      providerCalls++;
      return new Response(JSON.stringify(payload));
    },
  };
  const evidence: ImmutableEvidenceStore = {
    captureArtifact: async () => {
      artifactCalls++;
      return {
        ref: "evidence/keyword_metric/dataforseo/abc.json",
        sha256: "a".repeat(64),
        capturedAt: "2026-01-01T00:00:00.000Z",
        provider: "dataforseo",
        adapterVersion: "phase-3a",
        family: "KEYWORD_METRIC",
        contentType: "application/json",
      };
    },
  };
  return {
    service: createKeywordResearchRunService({
      transport,
      evidence,
      repository,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => `id-${++nextId}`,
    }),
    providerCalls: () => providerCalls,
    artifactCalls: () => artifactCalls,
    keywordMetricsCache,
    repository,
  };
}

describe("KeywordResearchRunService", () => {
  it("persists project-scoped canonical lineage and replays without refetching", async () => {
    const f = fixture({
      tasks: [
        {
          status_code: 20000,
          result: [
            {
              keyword: "  CRM Software ",
              search_volume: 120,
              cpc: 3.5,
              competition_index: 42,
            },
          ],
        },
      ],
    });
    const created = await f.service.create({
      projectId: "project-a",
      query: " CRM Software ",
      market: "US",
      language: "en",
    });
    expect(f.providerCalls()).toBe(1);
    expect(f.artifactCalls()).toBe(1);
    expect(created).toMatchObject({
      projectId: "project-a",
      normalizedQuery: "crm software",
      status: "COMPLETED",
      market: "US",
      language: "en",
    });
    expect(created.observations).toHaveLength(1);
    expect(created.observations[0]).toMatchObject({
      provider: "dataforseo",
      rawArtifactRef: "evidence/keyword_metric/dataforseo/abc.json",
      artifactSha256: "a".repeat(64),
      demandState: "VALIDATED",
    });
    const replay = await f.service.get("project-a", created.id);
    expect(replay).toEqual(created);
    expect(f.providerCalls()).toBe(1);
    expect(f.artifactCalls()).toBe(1);
    expect(await f.service.get("project-b", created.id)).toBeNull();
    expect(await f.service.list("project-a")).toHaveLength(1);
    expect(await f.service.list("project-b")).toHaveLength(0);
  });

  it("persists explicit provider failure without synthesizing an observation or fallback", async () => {
    const f = fixture({
      tasks: [{ status_code: 40501, status_message: "bad task" }],
    });
    const failed = await f.service.create({
      projectId: "project-a",
      query: "crm",
      market: "US",
      language: "en",
    });
    expect(failed).toMatchObject({
      status: "FAILED",
      failureCode: "PROVIDER_TASK_FAILURE",
      failureArtifactRef: "evidence/keyword_metric/dataforseo/abc.json",
      failureArtifactSha256: "a".repeat(64),
      observations: [],
    });
    expect(f.providerCalls()).toBe(1);
    expect(f.artifactCalls()).toBe(1);
  });

  it("creates distinct historical lineages for separate acquisitions", async () => {
    const f = fixture({
      tasks: [
        { status_code: 20000, result: [{ keyword: "crm", search_volume: 1 }] },
      ],
    });
    const first = await f.service.create({
      projectId: "project-a",
      query: "crm",
      market: "US",
      language: "en",
    });
    const second = await f.service.create({
      projectId: "project-a",
      query: "crm",
      market: "US",
      language: "en",
    });
    expect(first.id).not.toBe(second.id);
    expect(await f.service.list("project-a")).toHaveLength(2);
    expect(f.providerCalls()).toBe(2);
  });

  it("keeps the canonical snapshot independent from mutable keyword-metric cache data", async () => {
    const f = fixture({
      tasks: [
        {
          status_code: 20000,
          result: [{ keyword: "crm", search_volume: 120 }],
        },
      ],
    });
    const created = await f.service.create({
      projectId: "project-a",
      query: "crm",
      market: "US",
      language: "en",
    });
    f.keywordMetricsCache.set("project-a:crm", {
      searchVolume: 0,
      overwritten: true,
    });
    const replay = await f.service.get("project-a", created.id);
    expect(replay?.observations[0]?.canonicalObservation.searchVolume).toEqual({
      status: "PRESENT",
      value: 120,
    });
    expect(replay?.observations[0]).toMatchObject({
      provider: "dataforseo",
      market: "US",
      language: "en",
      demandState: "VALIDATED",
      rawArtifactRef: "evidence/keyword_metric/dataforseo/abc.json",
      artifactSha256: "a".repeat(64),
    });
  });

  it("rejects canonical observations whose artifact SHA is not a SHA-256 digest", async () => {
    const f = fixture({
      tasks: [
        {
          status_code: 20000,
          result: [{ keyword: "crm", search_volume: 120 }],
        },
      ],
    });
    // The acquisition adapter carries the evidence digest into the canonical
    // observation, so corrupting the immutable-artifact contract is rejected
    // before a canonical record can be completed.
    const service = createKeywordResearchRunService({
      transport: {
        execute: async () =>
          new Response(
            JSON.stringify({
              tasks: [
                {
                  status_code: 20000,
                  result: [{ keyword: "crm", search_volume: 120 }],
                },
              ],
            }),
          ),
      },
      evidence: {
        captureArtifact: async () => ({
          ref: "evidence/keyword_metric/dataforseo/invalid.json",
          sha256: "not-a-digest",
          capturedAt: "2026-01-01T00:00:00.000Z",
          provider: "dataforseo",
          adapterVersion: "phase-3a",
          family: "KEYWORD_METRIC",
          contentType: "application/json",
        }),
      },
      repository: f.repository,
    });
    await expect(
      service.create({
        projectId: "project-a",
        query: "crm",
        market: "US",
        language: "en",
      }),
    ).rejects.toThrow("violates run lineage");
  });
});

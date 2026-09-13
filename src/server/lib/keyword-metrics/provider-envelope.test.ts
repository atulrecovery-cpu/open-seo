import { describe, expect, it } from "vitest";
import { acquireDataForSeoKeywordMetrics } from "@/server/lib/keyword-metrics/dataforseo";
import type { KeywordMetricRawTransport } from "@/server/lib/keyword-metrics/dataforseo-transport";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";

const request = { queries: ["best accounting software for small business"], language: "en" as const, market: "US" as const };
const artifact = { ref: "evidence/keyword_metric/dataforseo/fixture.json", sha256: "b".repeat(64), capturedAt: "2026-09-13T00:00:00.000Z", provider: "dataforseo", adapterVersion: "phase-3a", family: "KEYWORD_METRIC" as const, contentType: "application/json" };

function fixture(payload: unknown): { transport: KeywordMetricRawTransport; evidence: ImmutableEvidenceStore; captured: Uint8Array[] } {
  const bytes = new TextEncoder().encode(JSON.stringify(payload)); const captured: Uint8Array[] = [];
  return {
    transport: { execute: async () => new Response(bytes) },
    evidence: { captureArtifact: async (input) => { captured.push(input.bytes); return artifact; } },
    captured,
  };
}

function successfulTask(result: unknown) { return { tasks: [{ status_code: 20000, status_message: "Ok", result }] }; }

describe("DataForSEO keyword-metric provider envelope", () => {
  it.each([
    ["failed task", { tasks: [{ status_code: 40000, status_message: "Invalid field" }] }, "PROVIDER_TASK_FAILURE"],
    ["missing tasks", {}, "MALFORMED_PROVIDER_ENVELOPE"],
    ["wrong-type tasks", { tasks: {} }, "MALFORMED_PROVIDER_ENVELOPE"],
    ["zero tasks", { tasks: [] }, "MALFORMED_PROVIDER_ENVELOPE"],
    ["multiple tasks", { tasks: [{ status_code: 20000, result: [] }, { status_code: 20000, result: [] }] }, "MALFORMED_PROVIDER_ENVELOPE"],
    ["malformed task", { tasks: [{ result: [] }] }, "MALFORMED_PROVIDER_ENVELOPE"],
    ["missing result", successfulTask(undefined), "MISSING_RESULT"],
    ["null result", successfulTask(null), "MISSING_RESULT"],
    ["wrong result type", successfulTask({}), "MALFORMED_PROVIDER_ENVELOPE"],
    ["empty result", successfulTask([]), "MISSING_RESULT"],
  ] as const)("returns %s as %s with artifact lineage and zero observations", async (_name, payload, kind) => {
    const f = fixture(payload); const result = await acquireDataForSeoKeywordMetrics(request, f.transport, f.evidence);
    expect(result).toMatchObject({ kind, artifact: { ref: artifact.ref, sha256: artifact.sha256 }, observations: [] });
    expect(f.captured).toHaveLength(1); expect(f.captured[0]).toEqual(new TextEncoder().encode(JSON.stringify(payload)));
  });

  it("constructs an artifact-backed observation for a successful envelope", async () => {
    const payload = successfulTask([{ keyword: request.queries[0], search_volume: 120, cpc: 2.5, competition_index: 42 }]);
    const f = fixture(payload); const result = await acquireDataForSeoKeywordMetrics(request, f.transport, f.evidence);
    expect(result).toMatchObject({ kind: "SUCCESS" }); expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({ evidence: { rawArtifactRef: artifact.ref, sha256: artifact.sha256 }, searchVolume: { status: "PRESENT", value: 120 } });
  });
});

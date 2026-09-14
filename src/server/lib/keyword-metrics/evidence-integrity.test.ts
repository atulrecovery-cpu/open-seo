import { describe, expect, it } from "vitest";
import { createR2RawEvidenceStore } from "@/server/lib/serp-providers/evidence";
import { acquireDataForSeoKeywordMetrics } from "@/server/lib/keyword-metrics/dataforseo";

type Stored = { bytes: Uint8Array; metadata: Record<string, string> };
function memoryStore() {
  const values = new Map<string, Stored>();
  const bucket = { head: async (key: string) => values.has(key) ? {} : null, put: async (key: string, value: Uint8Array, options: { customMetadata: Record<string, string> }) => { values.set(key, { bytes: value, metadata: options.customMetadata }); } } as unknown as R2Bucket;
  return { store: createR2RawEvidenceStore(bucket), values };
}
const base = { family: "KEYWORD_METRIC" as const, provider: "dataforseo", requestMetadata: { queries: ["x"], market: "US", language: "en", authorization: "AUTH_SHOULD_NOT_PERSIST", password: "PASSWORD_SHOULD_NOT_PERSIST", token: "TOKEN_SHOULD_NOT_PERSIST", cookie: "COOKIE_SHOULD_NOT_PERSIST" }, capturedAt: "2026-09-13T00:00:00.000Z", status: 200, providerVersion: null, adapterVersion: "phase-3a" };
describe("keyword-metric evidence integrity", () => {
  it("hashes exact bytes deterministically and preserves the KEYWORD_METRIC family", async () => {
    const { store, values } = memoryStore(); const compact = new TextEncoder().encode('{"a":1}'); const spaced = new TextEncoder().encode('{ "a": 1 }');
    const one = await store.captureArtifact({ ...base, bytes: compact }); const two = await store.captureArtifact({ ...base, bytes: compact }); const three = await store.captureArtifact({ ...base, bytes: spaced });
    expect(one.sha256).toBe(two.sha256); expect(one.sha256).not.toBe(three.sha256); expect(one.family).toBe("KEYWORD_METRIC"); expect(values.get(one.ref)?.bytes).toEqual(compact);
    const metadata = JSON.stringify(values.get(one.ref)?.metadata); expect(metadata).not.toContain("AUTH_SHOULD_NOT_PERSIST"); expect(metadata).not.toContain("PASSWORD_SHOULD_NOT_PERSIST"); expect(metadata).not.toContain("TOKEN_SHOULD_NOT_PERSIST"); expect(metadata).not.toContain("COOKIE_SHOULD_NOT_PERSIST");
  });
  it("links a successful canonical observation to the production R2 artifact", async () => {
    const { store, values } = memoryStore(); const payload = { tasks: [{ status_code: 20000, result: [{ keyword: "x", search_volume: 10 }] }] }; const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const result = await acquireDataForSeoKeywordMetrics({ queries: ["x"], language: "en", market: "US" }, { execute: async () => new Response(bytes) }, store);
    expect(result).toMatchObject({ kind: "SUCCESS" });
    if (result.kind !== "SUCCESS") throw new Error("expected successful acquisition");
    expect(result.observations).toHaveLength(1); expect(values.size).toBe(1);
    const [ref, stored] = [...values.entries()][0]; const digest = await crypto.subtle.digest("SHA-256", bytes); const sha = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(stored.bytes).toEqual(bytes); expect(ref).toContain(sha); expect(result.artifact.sha256).toBe(sha); expect(result.observations[0].evidence).toMatchObject({ family: "KEYWORD_METRIC", rawArtifactRef: ref, sha256: sha });
  });
});

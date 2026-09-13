import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";
import type { CanonicalKeywordMetricRequest } from "@/server/lib/keyword-metrics/types";
export type RawMetricResult = { kind: "SUCCESS"; artifact: { ref: string; sha256: string }; payload: unknown } | { kind: "EVIDENCE_PERSISTENCE_FAILURE"; message: string } | { kind: "HTTP_PROVIDER_FAILURE"; status: number; artifact: { ref: string; sha256: string } } | { kind: "PARSE_FAILURE"; artifact: { ref: string; sha256: string } } | { kind: "PROVIDER_ENVELOPE_FAILURE"; artifact: { ref: string; sha256: string } };
export async function acquireRawKeywordMetrics(response: Response, request: CanonicalKeywordMetricRequest, store: ImmutableEvidenceStore): Promise<RawMetricResult> {
  const bytes = new Uint8Array(await response.arrayBuffer()); let artifact;
  try { artifact = await store.captureArtifact({ family: "KEYWORD_METRIC", provider: "dataforseo", requestMetadata: { queries: request.queries, market: request.market, language: request.language, requestFamily: "keywords_data/google_ads/search_volume/live" }, capturedAt: new Date().toISOString(), status: response.status, bytes, providerVersion: null, adapterVersion: "phase-3a" }); } catch (error) { return { kind: "EVIDENCE_PERSISTENCE_FAILURE", message: error instanceof Error ? error.message : "evidence persistence failed" }; }
  if (!response.ok) return { kind: "HTTP_PROVIDER_FAILURE", status: response.status, artifact };
  let payload: unknown; try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { kind: "PARSE_FAILURE", artifact }; }
  if (!response.ok || !payload || typeof payload !== "object") return { kind: "PROVIDER_ENVELOPE_FAILURE", artifact };
  return { kind: "SUCCESS", artifact, payload };
}

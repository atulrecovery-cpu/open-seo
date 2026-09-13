import { metricObservationId, metricValue, type CanonicalKeywordMetricRequest, type KeywordMetricObservation, type KeywordMetricProvider } from "@/server/lib/keyword-metrics/types";
import { acquireRawKeywordMetrics } from "@/server/lib/keyword-metrics/raw-acquisition";
import type { KeywordMetricRawTransport } from "@/server/lib/keyword-metrics/dataforseo-transport";
import type { ImmutableEvidenceStore } from "@/server/lib/serp-providers/evidence";
/** Adapter input is deliberately a raw-independent row shape; DataForSEO wire types stay outside intelligence. */
export class DataForSeoKeywordMetricAdapter implements KeywordMetricProvider {
  constructor(private readonly acquire: (request: CanonicalKeywordMetricRequest) => Promise<{ rows: Array<{ keyword: string; search_volume?: unknown; cpc?: unknown; competition_index?: unknown; monthly_searches?: Array<{ year?: unknown; month?: unknown; search_volume?: unknown }> }>; capturedAt: string; evidence: { family: "KEYWORD_METRIC"; id: string; rawArtifactRef: string; sha256: string; captureId: string } }>) {}
  async fetchMetrics(request: CanonicalKeywordMetricRequest) {
    const raw = await this.acquire(request); const observations: KeywordMetricObservation[] = []; const failures = [] as const;
    for (const row of raw.rows) { const query = row.keyword.normalize("NFKC").trim(); const monthly = (row.monthly_searches ?? []).map((m) => ({ year: Number(m.year), month: Number(m.month), searchVolume: metricValue(m.search_volume) })).sort((a,b) => a.year-b.year || a.month-b.month); const invalidMonth = monthly.some((m) => !Number.isInteger(m.year) || m.year < 2000 || !Number.isInteger(m.month) || m.month < 1 || m.month > 12); observations.push({ id: metricObservationId(query, request.language, request.market, raw.evidence.sha256), queryId: `query_${query.toLowerCase()}_${request.language}_${request.market}`, originalQuery: query, normalizedQuery: query.toLowerCase(), language: request.language, market: request.market, provider: "dataforseo", providerMetricType: "google_ads_search_volume", capturedAt: raw.capturedAt, freshness: "KNOWN_CAPTURE_TIME", evidence: raw.evidence, searchVolume: metricValue(row.search_volume), cpc: metricValue(row.cpc), paidAdvertiserCompetition: metricValue(row.competition_index), monthlySearches: invalidMonth ? [] : monthly, providerMetadata: { locationCode: 0, languageCode: request.language, mappingVersion: "phase-3a-v1" } }); }
    return { observations, failures: [...failures] };
  }
}

/** Production orchestration: transport → exact-byte evidence → envelope → canonical rows. */
export async function acquireDataForSeoKeywordMetrics(request: CanonicalKeywordMetricRequest, transport: KeywordMetricRawTransport, evidence: ImmutableEvidenceStore) {
  const raw = await acquireRawKeywordMetrics(await transport.execute(request), request, evidence);
  if (raw.kind !== "SUCCESS") return { kind: raw.kind, artifact: "artifact" in raw ? raw.artifact : null, observations: [] as KeywordMetricObservation[] };
  const envelope = raw.payload as { tasks?: unknown };
  if (!envelope || typeof envelope !== "object" || !Array.isArray(envelope.tasks) || envelope.tasks.length !== 1) return { kind: "MALFORMED_PROVIDER_ENVELOPE" as const, artifact: raw.artifact, observations: [] as KeywordMetricObservation[] };
  const task = envelope.tasks[0] as { status_code?: unknown; status_message?: unknown; result?: unknown };
  if (!task || typeof task !== "object" || typeof task.status_code !== "number") return { kind: "MALFORMED_PROVIDER_ENVELOPE" as const, artifact: raw.artifact, observations: [] as KeywordMetricObservation[] };
  if (task.status_code !== 20000) return { kind: "PROVIDER_TASK_FAILURE" as const, artifact: raw.artifact, observations: [] as KeywordMetricObservation[] };
  if (task.result == null || (Array.isArray(task.result) && task.result.length === 0)) return { kind: "MISSING_RESULT" as const, artifact: raw.artifact, observations: [] as KeywordMetricObservation[] };
  if (!Array.isArray(task.result)) return { kind: "MALFORMED_PROVIDER_ENVELOPE" as const, artifact: raw.artifact, observations: [] as KeywordMetricObservation[] };
  const normalized = (value: string) => value.normalize("NFKC").trim().toLowerCase();
  const requested = new Set(request.queries.map(normalized));
  const rows = task.result!.filter((row): row is { keyword: string; search_volume?: unknown; cpc?: unknown; competition_index?: unknown } => typeof row.keyword === "string" && requested.has(normalized(row.keyword)));
  const duplicates = rows.map((row) => normalized(row.keyword)).filter((key, index, values) => values.indexOf(key) !== index);
  if (duplicates.length) return { kind: "DUPLICATE_PROVIDER_ROW" as const, artifact: raw.artifact, observations: [] as KeywordMetricObservation[], duplicateQueries: [...new Set(duplicates)] };
  const returned = new Set(rows.map((row) => normalized(row.keyword)));
  const missingRows = request.queries.filter((query) => !returned.has(normalized(query))).map((query) => ({ query, reason: "MISSING_PROVIDER_ROW" as const, artifactRef: raw.artifact.ref, sha256: raw.artifact.sha256 }));
  const adapter = new DataForSeoKeywordMetricAdapter(async () => ({ rows, capturedAt: raw.artifact.capturedAt, evidence: { family: "KEYWORD_METRIC", id: raw.artifact.ref, rawArtifactRef: raw.artifact.ref, sha256: raw.artifact.sha256, captureId: raw.artifact.ref } }));
  const result = await adapter.fetchMetrics(request);
  return { kind: "SUCCESS" as const, artifact: raw.artifact, observations: result.observations, missingRows };
}

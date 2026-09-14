import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demandFromCanonicalMetrics } from "@/server/lib/seo-intelligence/metric-demand";
import { intelligenceReportSchema } from "@/server/lib/seo-intelligence/types";
import type { KeywordMetricObservation } from "@/server/lib/keyword-metrics/types";
const root = "raw_evidence";
function json(path: string): Record<string, unknown> { return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function matchesSchema(document: Record<string, unknown>, schema: Record<string, unknown>): boolean {
  const { properties, required } = schema;
  if (!Array.isArray(required) || !required.every((key): key is string => typeof key === "string") || !isRecord(properties)) return false;
  const schemaVersion = properties.schema_version;
  if (!isRecord(schemaVersion) || typeof schemaVersion.const !== "string") return false;
  return required.every((key) => key in document) && document.schema_version === schemaVersion.const;
}
describe("controlled Phase 3A report", () => {
  it("validates the actual v1.1 report and preserves the frozen v1 report", () => { const v11 = json("schemas/seo-intelligence-v1.1.schema.json"); const report = json(`${root}/phase3a/controlled-keyword-metrics.report.json`); const v1Report = json(`${root}/phase2/controlled-commercial-comparison.report.json`); const incompleteReport = { ...report }; delete incompleteReport.keyword_metric_observations; expect(matchesSchema(report, v11)).toBe(true); expect(matchesSchema(incompleteReport, v11)).toBe(false); expect(intelligenceReportSchema.safeParse(v1Report).success).toBe(true); });
  it("replays controlled artifact-backed demand without provider acquisition", () => { const observation: KeywordMetricObservation = { id: "metric-controlled", queryId: "q", originalQuery: "best accounting software for small business", normalizedQuery: "best accounting software for small business", language: "en", market: "US", provider: "dataforseo", providerMetricType: "google_ads_search_volume", capturedAt: "2026-09-13T00:00:00.000Z", freshness: "KNOWN_CAPTURE_TIME", evidence: { family: "KEYWORD_METRIC", id: "metric-controlled", rawArtifactRef: "evidence/keyword_metric/dataforseo/controlled.json", sha256: "a".repeat(64), captureId: "controlled-capture" }, searchVolume: { status: "PRESENT", value: 120 }, cpc: { status: "PRESENT", value: 2.5 }, paidAdvertiserCompetition: { status: "PRESENT", value: 42 }, monthlySearches: [], providerMetadata: { locationCode: 2840, languageCode: "en", mappingVersion: "v1" } }; expect(demandFromCanonicalMetrics({ normalizedQuery: observation.normalizedQuery, language: "en", market: "US", searchObserved: true }, [observation])).toBe("VALIDATED"); });
});

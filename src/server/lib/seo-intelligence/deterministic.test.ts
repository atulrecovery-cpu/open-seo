import { describe, expect, it } from "vitest";
import { assessIntent, classifyDemand, commercialSignals, competitorsFromCanonical, deriveIntelligence, normalizeQuery, problemSignals, queryIdentity } from "@/server/lib/seo-intelligence/deterministic";
import { controlledFixtures } from "@/server/lib/seo-intelligence/fixtures";
import { intelligenceReportSchema } from "@/server/lib/seo-intelligence/types";

describe("deterministic SEO intelligence", () => {
  it("normalizes query wording without stemming and identities retain market context", () => {
    expect(normalizeQuery("  Café　TOOLS! ")).toBe("café tools!");
    expect(queryIdentity(controlledFixtures.commercialComparison.observation)).not.toBe(queryIdentity({ ...controlledFixtures.commercialComparison.observation, region: "DE" }));
  });
  it("preserves evidence categories and does not turn SERP presence into validated demand", () => {
    const report = deriveIntelligence(controlledFixtures.commercialComparison);
    expect(report.observed.signals[0].evidence.category).toBe("SEARCH_OBSERVED");
    expect(report.derived.demand).toBe("INDICATED");
    expect(report.model_inferred).toEqual([]);
    expect(classifyDemand([{ type: "KEYWORD_METRIC", evidence: { ...report.observed.query.evidence, category: "PROVIDER_METRIC" } }])).toBe("VALIDATED");
    expect(classifyDemand([], "NOT_VALIDATED")).toBe("NOT_VALIDATED");
  });
  it("extracts transparent intent, commercial, problem, and observed JTBD signals", () => {
    const evidence = controlledFixtures.localService.observation.evidence;
    expect(assessIntent("seo agency near me", evidence).intent).toBe("local");
    expect(commercialSignals("best accounting software", evidence).map((s) => s.type)).toContain("software_tool");
    expect(problemSignals("remove background from image", evidence)[0].category).toBe("remove");
    expect(deriveIntelligence(controlledFixtures.directProblem).derived.jtbd.basis).toBe("OBSERVED");
  });
  it("uses only verified destinations for competitor observations", () => {
    expect(competitorsFromCanonical("q", controlledFixtures.commercialComparison.competitors)).toHaveLength(1);
    expect(deriveIntelligence(controlledFixtures.ambiguous).observed.competitors).toEqual([]);
  });
  it("retains lineage, unknowns, and deterministic replay", () => {
    const first = deriveIntelligence(controlledFixtures.ambiguous); const second = deriveIntelligence(controlledFixtures.ambiguous);
    expect(first).toEqual(second); expect(first.unknowns.map((u) => u.topic)).toContain("search_demand");
    expect(first.observed.query.evidence.captureId).toBe("capture-case-f");
  });
  it("builds opportunity next actions and validates every controlled fixture contract", () => {
    for (const fixture of Object.values(controlledFixtures)) expect(intelligenceReportSchema.safeParse(deriveIntelligence(fixture)).success).toBe(true);
    expect(deriveIntelligence(controlledFixtures.commercialComparison).derived.opportunity.nextAction.type).toBe("OBTAIN_KEYWORD_METRIC");
  });
  it("can represent contradictions without forcing resolution", () => {
    const contradiction = { claim: "commercial intent", supportingEvidenceRefs: ["a"], conflictingEvidenceRefs: ["b"], status: "OPEN" as const, notes: "comparison wording conflicts with explanatory wording" };
    expect(contradiction.status).toBe("OPEN");
  });
});

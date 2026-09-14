import { describe, expect, it } from "vitest";
import { isEligibleForTargetDomainMatch, normalizeDirectDestination, OpenSerpAdapter, openSerpCapabilities, openSerpDeviceSemantics } from "@/server/lib/serp-providers/openserp";
import {
  sha256Hex,
  type RawEvidenceStore,
} from "@/server/lib/serp-providers/evidence";
import type { SerpRequest } from "@/server/lib/serp-providers/types";

const request: SerpRequest = { query: "best accounting software for small business", engine: "google", language: "EN", region: "US", start: 0, limit: 10 };
const raw = JSON.stringify({ meta: { requested_at: "2026-09-13T15:12:22Z", version: "2.1" }, results: [{ rank: 1, type: "organic", title: "Wave", url: "https://www.google.com/goto?url=opaque", domain: "google.com", snippet: "Accounting", position: { absolute: 3 } }, { rank: 2, type: "organic", title: "Direct", url: "https://example.com/", domain: "example.com", snippet: "Direct", position: { absolute: 4 } }], serp_features: [{ type: "ai_summary" }], pagination: { page: 1, has_more: false, next_start: 10 } });

function evidenceStore(): RawEvidenceStore {
  return { capture: async (input) => ({ ref: "serp-evidence/openserp/test.json", sha256: await sha256Hex(input.bytes), capturedAt: input.capturedAt, provider: input.provider, adapterVersion: input.adapterVersion }) };
}

function adapter(body = raw) {
  return new OpenSerpAdapter("http://127.0.0.1:7000", evidenceStore(), async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } }));
}

describe("OpenSerpAdapter", () => {
  it("normalizes organic rank separately from absolute position and links evidence", async () => {
    const result = await adapter().acquire(request);
    expect(result.provider).toBe("openserp");
    expect(result.capturedAt).toBe("2026-09-13T15:12:22Z");
    expect(result.organicResults[1]).toMatchObject({ organicRank: 2, absolutePosition: 4, title: "Direct", snippet: "Direct", domain: "example.com", destinationDomainUsable: true });
    expect(result.features).toEqual(["ai_summary"]);
    expect(result.evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves redirect-wrapper evidence but makes its destination identity unusable", async () => {
    const result = await adapter().acquire(request);
    expect(result.organicResults[0]).toMatchObject({ organicRank: 1, absolutePosition: 3, url: null, domain: null, destinationIdentity: "WRAPPER_ONLY", destinationUrlUsable: false, destinationDomainUsable: false });
    expect(isEligibleForTargetDomainMatch(result.organicResults[0])).toBe(false);
  });

  it("does not decode a recoverable-looking or malformed Google wrapper", async () => {
    const wrappers = ["https://www.google.com/goto?url=https%3A%2F%2Fevil.example%2F", "https://www.google.com/goto?url=%ZZ"];
    for (const url of wrappers) {
      const body = JSON.stringify({ meta: { requested_at: "2026-09-13T15:12:22Z" }, results: [{ rank: 1, type: "organic", url, domain: "google.com" }] });
      const result = await adapter(body).acquire(request);
      expect(result.organicResults[0]).toMatchObject({ url: null, domain: null, destinationIdentity: "WRAPPER_ONLY", destinationUrlUsable: false });
    }
  });

  it("normalizes a direct canonical HTTP(S) URL and only that identity can match", async () => {
    const direct = normalizeDirectDestination("HTTPS://WWW.Example.COM./path?q=1#fragment");
    expect(direct).toEqual({ url: "https://www.example.com/path?q=1", domain: "www.example.com" });
    const result = await adapter().acquire(request);
    expect(result.organicResults[1]).toMatchObject({ url: "https://example.com/", domain: "example.com", destinationIdentity: "VERIFIED_DESTINATION" });
    expect(isEligibleForTargetDomainMatch(result.organicResults[1])).toBe(true);
    expect(normalizeDirectDestination("javascript:alert(1)")).toBeNull();
  });

  it("rejects a device-specific request instead of mislabeling results", async () => {
    await expect(adapter().acquire({ ...request, device: "mobile" })).rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });

  it("fails explicitly on malformed provider output", async () => {
    await expect(adapter("not-json").acquire(request)).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("advertises the verified OpenSERP limitations", () => {
    expect(openSerpCapabilities).toMatchObject({ organicSerp: "VERIFIED", desktop: "UNSUPPORTED", mobile: "UNSUPPORTED", destinationDomain: "PARTIAL", paa: "UNVERIFIED" });
    expect(openSerpDeviceSemantics).toBe("NO_CONFIRMED_MOBILE_PROFILE");
  });
});

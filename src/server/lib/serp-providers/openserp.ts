import { z } from "zod";
import type { RawEvidenceStore } from "@/server/lib/serp-providers/evidence";
import {
  type SerpObservation,
  type SerpProvider,
  type SerpProviderCapabilities,
  SerpProviderError,
  type SerpRequest,
} from "@/server/lib/serp-providers/types";

export const OPENSERP_ADAPTER_VERSION = "phase-1.8";
export const openSerpCapabilities: SerpProviderCapabilities = {
  organicSerp: "VERIFIED", localizedSerp: "PARTIAL", desktop: "UNSUPPORTED",
  mobile: "UNSUPPORTED", destinationUrl: "PARTIAL", destinationDomain: "PARTIAL",
  paa: "UNVERIFIED", relatedSearches: "UNVERIFIED", pagination: "VERIFIED",
};

const envelopeSchema = z.object({
  meta: z.object({ requested_at: z.string(), version: z.string().optional() }),
  results: z.array(z.object({ rank: z.number().int().positive(), type: z.string(), title: z.string().optional(), url: z.string().optional(), domain: z.string().optional(), snippet: z.string().optional(), position: z.object({ absolute: z.number().int().positive().optional() }).optional() })),
  serp_features: z.array(z.object({ type: z.string() })).optional(),
  pagination: z.object({ page: z.number().int().optional(), has_more: z.boolean().optional(), next_start: z.number().int().optional() }).optional(),
});

function isGoogleRedirect(url: string | undefined, domain: string | undefined): boolean {
  if (!url) return false;
  try { const parsed = new URL(url); return parsed.hostname === "www.google.com" && parsed.pathname === "/goto" || domain === "google.com"; }
  catch { return domain === "google.com"; }
}

export class OpenSerpAdapter implements SerpProvider {
  readonly name = "openserp" as const;
  readonly capabilities = openSerpCapabilities;
  constructor(private readonly baseUrl: string, private readonly evidence: RawEvidenceStore, private readonly fetcher: typeof fetch = fetch) {}

  async acquire(request: SerpRequest): Promise<SerpObservation> {
    if (request.device) throw new SerpProviderError("UNSUPPORTED_CAPABILITY", "OpenSERP has no verified device-specific request capability");
    const url = new URL("/google/search", this.baseUrl);
    url.search = new URLSearchParams({ text: request.query, lang: request.language, region: request.region, limit: String(request.limit), start: String(request.start), features: "true" }).toString();
    let response: Response;
    try { response = await this.fetcher(url); }
    catch (error) { throw new SerpProviderError("PROVIDER_UNAVAILABLE", error instanceof Error ? error.message : "OpenSERP request failed"); }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const capturedAt = new Date().toISOString();
    const evidence = await this.evidence.capture({ provider: this.name, request, capturedAt, status: response.status, headers: Object.fromEntries(response.headers), bytes, providerVersion: response.headers.get("x-openserp-version"), adapterVersion: OPENSERP_ADAPTER_VERSION });
    if (response.status === 429) throw new SerpProviderError("RATE_LIMITED", "OpenSERP rate limited the request");
    if (!response.ok) throw new SerpProviderError("PROVIDER_UNAVAILABLE", `OpenSERP returned HTTP ${response.status}`);
    let parsed: z.infer<typeof envelopeSchema>;
    try { parsed = envelopeSchema.parse(JSON.parse(new TextDecoder().decode(bytes))); }
    catch { throw new SerpProviderError("MALFORMED_RESPONSE", "OpenSERP returned an invalid search envelope"); }
    const organic = parsed.results.filter((r) => r.type === "organic");
    if (organic.length === 0) throw new SerpProviderError("INCOMPLETE_RESPONSE", "OpenSERP returned no organic results");
    return {
      provider: this.name, providerVersion: parsed.meta.version ?? null, adapterVersion: OPENSERP_ADAPTER_VERSION,
      capturedAt: parsed.meta.requested_at, request, deviceKnown: false, localizationFidelity: "PARTIAL", evidence,
      organicResults: organic.map((r) => {
        const unsafe = isGoogleRedirect(r.url, r.domain);
        return { organicRank: r.rank, absolutePosition: r.position?.absolute ?? null, title: r.title ?? null, url: unsafe ? null : r.url ?? null, domain: unsafe ? null : r.domain ?? null, snippet: r.snippet ?? null, resultType: "organic", destinationUrlUsable: !unsafe && Boolean(r.url), destinationDomainUsable: !unsafe && Boolean(r.domain) };
      }),
      features: parsed.serp_features?.map((f) => f.type) ?? [],
      pagination: { page: parsed.pagination?.page ?? null, hasMore: parsed.pagination?.has_more ?? null, nextStart: parsed.pagination?.next_start ?? null },
    };
  }
}

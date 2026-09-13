import { z } from "zod";

export const serpRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  engine: z.literal("google"),
  language: z.string().trim().min(2).max(16),
  region: z.string().trim().min(2).max(128),
  device: z.enum(["desktop", "mobile"]).optional(),
  start: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(10),
});

export type SerpRequest = z.infer<typeof serpRequestSchema>;

export function serializeSerpRequest(request: SerpRequest): string {
  return JSON.stringify({
    device: request.device ?? null,
    engine: request.engine,
    language: request.language,
    limit: request.limit,
    query: request.query,
    region: request.region,
    start: request.start,
  });
}

export const capabilityStateSchema = z.enum([
  "VERIFIED",
  "PARTIAL",
  "UNSUPPORTED",
  "UNVERIFIED",
]);
export type CapabilityState = z.infer<typeof capabilityStateSchema>;

export type SerpProviderCapabilities = {
  organicSerp: CapabilityState;
  localizedSerp: CapabilityState;
  desktop: CapabilityState;
  mobile: CapabilityState;
  destinationUrl: CapabilityState;
  destinationDomain: CapabilityState;
  paa: CapabilityState;
  relatedSearches: CapabilityState;
  pagination: CapabilityState;
};

export type RawEvidence = {
  ref: string;
  sha256: string;
  capturedAt: string;
  provider: string;
  adapterVersion: string;
};

export type OrganicSerpResult = {
  organicRank: number;
  absolutePosition: number | null;
  title: string | null;
  url: string | null;
  domain: string | null;
  snippet: string | null;
  resultType: "organic";
  /**
   * `VERIFIED_DESTINATION` means the provider supplied a direct canonical HTTP(S)
   * URL. Wrapper and inferred candidates must never receive this state.
   */
  destinationIdentity: "VERIFIED_DESTINATION" | "WRAPPER_ONLY" | "UNVERIFIED_DESTINATION";
  destinationUrlUsable: boolean;
  destinationDomainUsable: boolean;
};

export type SerpObservation = {
  provider: string;
  providerVersion: string | null;
  adapterVersion: string;
  capturedAt: string;
  request: SerpRequest;
  deviceKnown: boolean;
  localizationFidelity: "YES" | "PARTIAL" | "NO";
  evidence: RawEvidence;
  organicResults: OrganicSerpResult[];
  features: string[];
  pagination: { page: number | null; hasMore: boolean | null; nextStart: number | null };
};

export type SerpProviderErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "PARSE_FAILURE"
  | "INCOMPLETE_RESPONSE"
  | "UNSAFE_DESTINATION_IDENTITY"
  | "RATE_LIMITED"
  | "UNKNOWN_PROVIDER_FAILURE";

export class SerpProviderError extends Error {
  constructor(public readonly code: SerpProviderErrorCode, message: string) {
    super(message);
    this.name = "SerpProviderError";
  }
}

export interface SerpProvider {
  readonly name: "dataforseo" | "openserp";
  readonly capabilities: SerpProviderCapabilities;
  acquire(request: SerpRequest): Promise<SerpObservation>;
}

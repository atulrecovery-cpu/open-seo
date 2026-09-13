import type { RawEvidence, SerpRequest } from "@/server/lib/serp-providers/types";
import { serializeSerpRequest } from "@/server/lib/serp-providers/types";

export interface RawEvidenceStore {
  capture(input: {
    provider: string;
    request: SerpRequest;
    capturedAt: string;
    status: number;
    headers: Record<string, string>;
    bytes: Uint8Array;
    providerVersion: string | null;
    adapterVersion: string;
  }): Promise<RawEvidence>;
}

export type EvidenceFamily = "SERP" | "KEYWORD_METRIC";
export type ImmutableEvidenceArtifact = RawEvidence & { family: EvidenceFamily; contentType: string };
export type ImmutableEvidenceInput = { family: EvidenceFamily; provider: string; requestMetadata: Record<string, unknown>; capturedAt: string; status: number; bytes: Uint8Array; providerVersion: string | null; adapterVersion: string; contentType?: string };
export interface ImmutableEvidenceStore { captureArtifact(input: ImmutableEvidenceInput): Promise<ImmutableEvidenceArtifact>; }

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeRequestMetadata(family: EvidenceFamily, metadata: Record<string, unknown>): Record<string, unknown> {
  const allowed = family === "SERP" ? ["query", "engine", "language", "region", "device", "start", "limit"] : ["queries", "market", "language", "requestFamily", "locationCode", "locationName", "languageCode"];
  return Object.fromEntries(allowed.filter((key) => metadata[key] !== undefined).map((key) => [key, metadata[key]]));
}

/** Content-addressed R2 evidence: an existing key is never overwritten. */
export function createR2RawEvidenceStore(bucket: R2Bucket): RawEvidenceStore & ImmutableEvidenceStore {
  const captureArtifact: ImmutableEvidenceStore["captureArtifact"] = async (input) => {
      const digest = await sha256(input.bytes);
      const ref = input.family === "SERP" ? `serp-evidence/${input.provider}/${digest}.json` : `evidence/${input.family.toLowerCase()}/${input.provider}/${digest}.json`;
      const existing = await bucket.head(ref);
      if (!existing) {
        await bucket.put(ref, input.bytes, {
          httpMetadata: { contentType: "application/json" },
          customMetadata: {
            adapterVersion: input.adapterVersion,
            capturedAt: input.capturedAt,
            provider: input.provider,
            providerVersion: input.providerVersion ?? "",
            request: JSON.stringify(safeRequestMetadata(input.family, input.requestMetadata)),
            sha256: digest,
            status: String(input.status),
            family: input.family,
          },
        });
      }
      return { ref, sha256: digest, capturedAt: input.capturedAt, provider: input.provider, adapterVersion: input.adapterVersion, family: input.family, contentType: input.contentType ?? "application/json" };
  };
  return { captureArtifact, async capture(input) { const artifact = await captureArtifact({ ...input, family: "SERP", requestMetadata: JSON.parse(serializeSerpRequest(input.request)) }); return { ref: artifact.ref, sha256: artifact.sha256, capturedAt: artifact.capturedAt, provider: artifact.provider, adapterVersion: artifact.adapterVersion }; },
  };
}

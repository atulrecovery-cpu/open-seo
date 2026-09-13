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

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Content-addressed R2 evidence: an existing key is never overwritten. */
export function createR2RawEvidenceStore(bucket: R2Bucket): RawEvidenceStore {
  return {
    async capture(input) {
      const digest = await sha256(input.bytes);
      const ref = `serp-evidence/${input.provider}/${digest}.json`;
      const existing = await bucket.head(ref);
      if (!existing) {
        await bucket.put(ref, input.bytes, {
          httpMetadata: { contentType: "application/json" },
          customMetadata: {
            adapterVersion: input.adapterVersion,
            capturedAt: input.capturedAt,
            provider: input.provider,
            providerVersion: input.providerVersion ?? "",
            request: serializeSerpRequest(input.request),
            sha256: digest,
            status: String(input.status),
          },
        });
      }
      return { ref, sha256: digest, capturedAt: input.capturedAt, provider: input.provider, adapterVersion: input.adapterVersion };
    },
  };
}

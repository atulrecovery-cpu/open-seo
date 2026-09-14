import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/server/lib/serp-providers/evidence";

describe("sha256Hex", () => {
  it("hashes only the visible bytes of a sliced view", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 0]).subarray(1, 4);
    await expect(sha256Hex(bytes)).resolves.toBe(
      "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    );
  });

  it("hashes empty bytes and UTF-8 text deterministically", async () => {
    await expect(sha256Hex(new Uint8Array())).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    const hello = new TextEncoder().encode("hello");
    await expect(sha256Hex(hello)).resolves.toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    await expect(sha256Hex(hello)).resolves.toBe(await sha256Hex(hello));
  });
});

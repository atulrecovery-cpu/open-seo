import { describe, expect, it } from "vitest";
import {
  buildSamSkillSource,
  parseSamSkill,
} from "@/server/features/sam/samSkills";

describe("buildSamSkillSource", () => {
  // Guards the real failure modes: a skill whose frontmatter breaks (build
  // throws), an internal repo-dev skill leaking into SAM, or the public set
  // silently shrinking because a glob or marking change dropped it.
  it("serves exactly the public product skills", async () => {
    const source = buildSamSkillSource();
    const names = (await source.list()).map((skill) => skill.name);

    expect(names).toEqual([
      "competitive-landscape",
      "competitor-analysis",
      "keyword-clustering",
      "keyword-research",
      "link-prospecting",
      "local-seo",
      "seo-audit",
      "seo-coach",
      "seo-project-setup",
    ]);

    const loaded = await source.load("seo-project-setup");
    expect(loaded?.body).toContain("Surface note: you are SAM");
  });
});

describe("parseSamSkill", () => {
  it.each(["\n", "\r\n"])("accepts %j frontmatter line endings", (eol) => {
    const raw = [
      "---",
      "name: example",
      "description: Example skill",
      "---",
      "# Example",
    ].join(eol);

    expect(parseSamSkill("/skill.md", raw)).toMatchObject({
      name: "example",
      description: "Example skill",
      body: expect.stringContaining("# Example"),
    });
  });

  it("rejects malformed frontmatter", () => {
    expect(() => parseSamSkill("/skill.md", "name: example\n")).toThrow(
      "Skill has no frontmatter: /skill.md",
    );
  });
});

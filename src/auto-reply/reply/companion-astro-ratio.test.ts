import { describe, expect, it } from "vitest";
import { buildCompanionAstroRatioHint } from "./companion-astro-ratio.js";

describe("companion-astro-ratio", () => {
  it("requires 60/40 and single astro bubble", () => {
    const hint = buildCompanionAstroRatioHint();
    expect(hint).toContain("60% COMPANION");
    expect(hint).toContain("40% ASTROLOGY");
    expect(hint).toContain("bubble 1");
    expect(hint).toMatch(/at most ONE/i);
    expect(hint).toMatch(/Never use 2 astro-heavy bubbles/i);
  });
});

import { describe, expect, it } from "vitest";
import {
  canAcceptReadingRewrite,
  isNormalAstrologyReading,
  readingStyleIssues,
} from "./astrologer-reading-style.js";

export const reading =
  "Career progress looks gradual rather than sudden. Saturn supports steady effort and patience as you take on responsibility, while Mercury supports analytical work and clear communication with colleagues. These factors suggest focusing on work that rewards consistency and careful thinking.";

describe("astrologer reading style", () => {
  it("accepts a concise reading without forcing padding", () => {
    expect(isNormalAstrologyReading("Career kaisa rahega?", reading)).toBe(true);
    expect(readingStyleIssues(reading)).toEqual([]);
  });
  it("detects length, structure and engagement endings", () => {
    expect(readingStyleIssues("word ".repeat(106))).toContain("length");
    expect(readingStyleIssues("# Career\n" + reading)).toContain("format");
    expect(readingStyleIssues(reading + " Would you like more?")).toContain("ending");
    expect(readingStyleIssues(reading + " Abhi kya kaam karte hain?")).toContain("question");
    expect(readingStyleIssues("One. Two. Three. Four. Five.")).toContain("sentences");
  });
  it.each([
    "Explain in detail",
    "Write a draft",
    "tarot reading",
    "medical diagnosis",
    "Career? Marriage?",
    "1. Career\n2. Marriage",
  ])("preserves exception: %s", (prompt) => {
    expect(isNormalAstrologyReading(prompt, reading)).toBe(false);
  });
  it.each([
    "Aapki rashi Makar hai.",
    reading + " IMAGE_URL:https://example.com/chart.png",
    reading + " Please share your birth details.",
  ])("preserves facts, media and intake", (draft) => {
    expect(isNormalAstrologyReading("", draft)).toBe(false);
  });
  it("rejects changed verdicts, new dates and empty rewrites", () => {
    expect(canAcceptReadingRewrite(reading + " Would you like more?", reading)).toBe(true);
    expect(canAcceptReadingRewrite(reading, reading.replace("gradual", "guaranteed"))).toBe(false);
    expect(canAcceptReadingRewrite(reading, reading + " Expect change in 2027.")).toBe(false);
    expect(canAcceptReadingRewrite(reading + " In 2027.", reading)).toBe(false);
    expect(canAcceptReadingRewrite(reading, "")).toBe(false);
  });
});

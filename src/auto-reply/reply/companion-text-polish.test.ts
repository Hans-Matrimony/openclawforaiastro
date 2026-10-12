import { describe, expect, it } from "vitest";
import {
  polishCompanionReplyText,
  stripCompanionDashPunctuation,
} from "./companion-text-polish.js";

describe("companion-text-polish", () => {
  it("preserves paragraph boundaries, CRLF and nested list indentation", () => {
    const text = "Marriage\r\n\r\nCareer\r\n  - First\r\n    - Nested";
    expect(polishCompanionReplyText(text)).toBe(text);
  });

  it("preserves Markdown hard breaks while cleaning inline spacing", () => {
    expect(polishCompanionReplyText("First  step  \nSecond step")).toBe(
      "First step  \nSecond step",
    );
  });

  it("keeps fenced code unchanged while polishing surrounding prose", () => {
    const code = "```text\n    a  -  b\n\nmain hoon na — code\n```";
    expect(polishCompanionReplyText(`Before — note\n\n${code}\n\nAfter — note`)).toBe(
      `Before, note\n\n${code}\n\nAfter, note`,
    );
  });

  it("preserves an unfinished fenced code block", () => {
    const text = "Intro\n\n~~~text\n    a  —  b\n\nmain hoon na";
    expect(polishCompanionReplyText(text)).toBe(text);
  });

  it("replaces em-dash with comma", () => {
    expect(stripCompanionDashPunctuation("shaadi ka sawaal — mann bhatak")).toBe(
      "shaadi ka sawaal, mann bhatak",
    );
  });

  it("replaces spaced hyphen between words", () => {
    expect(stripCompanionDashPunctuation("hip hop se classical tak — versatile")).toBe(
      "hip hop se classical tak, versatile",
    );
  });

  it("keeps compound planet hyphen", () => {
    expect(stripCompanionDashPunctuation("Ketu-Venus ka time")).toBe("Ketu-Venus ka time");
  });

  it("softens jaisa pehle bataaya", () => {
    expect(polishCompanionReplyText("Jaisa pehle bataaya tha, March 2028")).toContain(
      "jaise chart mein dikhta hai",
    );
  });

  it("replaces phir wahi sawaal", () => {
    expect(polishCompanionReplyText("Itni raat ko phir wahi sawaal, mann mein kuch")).toContain(
      "shaadi ka sawaal",
    );
  });
});

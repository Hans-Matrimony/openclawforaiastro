import { describe, expect, it } from "vitest";
import { polishCompanionReplyText, stripCompanionDashPunctuation } from "./companion-text-polish.js";

describe("companion-text-polish", () => {
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

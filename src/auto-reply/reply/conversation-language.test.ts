import { describe, expect, it } from "vitest";
import {
  detectMessageLanguage,
  resolveCompanionLanguageMode,
} from "./conversation-language.js";

describe("conversation-language", () => {
  it("does not treat English tell me as Hinglish", () => {
    expect(detectMessageLanguage("tell me about my career")).toBe("english");
    expect(detectMessageLanguage("can u tell me about my education")).toBe("english");
    expect(detectMessageLanguage("hey how are you")).toBe("english");
    expect(detectMessageLanguage("when will i get marry")).toBe("english");
  });

  it("detects Hinglish when Hindi words present", () => {
    expect(detectMessageLanguage("meri shaadi ke baare main batao")).toBe("hinglish");
    expect(detectMessageLanguage("Mere career ke baare main batao")).toBe("hinglish");
  });

  it("detects Indic scripts", () => {
    expect(detectMessageLanguage("నమస్కారం")).toBe("telugu");
    expect(detectMessageLanguage("வணக்கம்")).toBe("tamil");
  });

  it("keeps session language on short replies", () => {
    expect(
      resolveCompanionLanguageMode({
        messageText: "Yes",
        sessionEntry: { companionLanguageMode: "telugu" } as never,
      }).mode,
    ).toBe("telugu");
  });

  it("switches to English on clear English message", () => {
    expect(
      resolveCompanionLanguageMode({
        messageText: "can u tell me about my career",
        sessionEntry: { companionLanguageMode: "hinglish" } as never,
      }).mode,
    ).toBe("english");
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const history = [
  { role: "user", text: "Please give one practical job-search step briefly in English." },
  { role: "assistant", text: "Update your LinkedIn profile with your current skills." },
];

for (const sourceFlow of [true, false]) {
  for (const language of ["hinglish", "hindi", "malayalam"]) {
    test(`current app preference replaces historical language policy: ${sourceFlow}/${language}`, async () => {
      const value = { query: "Job change ke liye ek practical kadam batao.", language, history, birth: {} };
      const context = await readingContext(value, { read: async () => ["Previously asked for English."] }, x => x, new Date(), { sourceFlow });
      assert.doesNotMatch(context.prompt, /NEVER blindly use the latest user turn|A newer explicit language instruction overrides an older one/);
      assert.match(context.prompt, new RegExp(`Response language for this turn: "${language}"`));
      assert.match(context.prompt, /CURRENT user message overrides/);
      assert.match(context.prompt, /Numbers, dates, emoji/);
      assert.ok(context.memoryFacts.includes("Previously asked for English."), "keep memory as context");
    });
  }
}

test("main answer and companion use the same language authority despite English history", async () => {
  const value = { query: "Job change ke liye ek practical kadam batao.", language: "hinglish", history, birth: {} };
  const context = await readingContext(value, { read: async () => [] }, x => x, new Date(), { sourceFlow: true });
  let generated = false;
  const result = await contextualClosing("Apne CV mein relevant projects saaf likhiye.", value, {
    facts: [], redact: x => x,
    generate: async (prompt, data) => {
      generated = true;
      const rule = context.prompt.match(/# Current-turn response language[^]*?(?=\n# Examples)/)?.[0].trim();
      assert.ok(rule && prompt.includes(rule));
      assert.equal(JSON.parse(data).language, "hinglish");
      return "Aap kis tarah ka role dekh rahe hain?";
    },
  });
  assert.ok(generated);
  assert.match(result, /^Apne CV/);
});

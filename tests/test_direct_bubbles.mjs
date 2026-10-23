import test from "node:test";
import assert from "node:assert/strict";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { formatReadingReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

void test("presentation asks for plain language and a short separate verdict", async () => {
  const value = { query: "education ke baare mein batao", language: "hinglish", history: [] };
  const context = await readingContext(value, { read: async () => [] }, (text) => text);
  assert.match(context.prompt, /Do not display bindu totals/);
  assert.match(context.prompt, /retrograde, combust, vakri/);
  assert.match(context.prompt, /second only the short direct answer/);
  const answer =
    "Padhai mein mehnat ka asar dheere nazar aa sakta hai.\n\nResults mein waqt lag sakta hai.";
  const followup = "Padhai mein abhi sabse zyada dikkat kis cheez mein aa rahi hai?";
  const reply = await contextualClosing(answer, value, { generate: async () => followup });
  assert.deepEqual(reply.split("\n\n"), [
    answer.split("\n\n")[0],
    "Results mein waqt lag sakta hai.",
    followup,
  ]);
  assert.equal(formatReadingReply(reply, true, { friendlyClosing: true }), reply);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { englishOnlyPracticalReply } from "../extensions/reviewed-reading/direct/response-language.mjs";

const history = [
  { role: "user", text: "Please give one practical job-search step briefly in English." },
  { role: "assistant", text: "Update your LinkedIn profile with your current skills." },
];

const query = "Maine abhi koi skill practice shuru nahi ki hai. Job change ke liye ek practical kadam batao.";
const englishDraft = "Update your LinkedIn profile with clear, recent achievements even if you haven’t practiced new skills yet.";
for (const persistent of [false, true]) {
  test(`observed English carry-over is corrected within existing practical budget: ${persistent}`, async () => {
    let calls = 0;
    const result = await directAnswer({ user_id: "language-test", query, language: "hinglish", history, birth: {} }, {
      env: { OPENROUTER_API_KEY: "test", VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_ENVIRONMENT: "development", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0" },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => { throw new Error("Unexpected chart tool"); },
      fetchImpl: async (_, options) => {
        calls++;
        const body = JSON.parse(options.body);
        if (calls === 2) {
          assert.match(body.messages.at(-1).content, /draft was entirely English/);
          assert.ok(body.messages.at(-1).content.includes(englishDraft));
        }
        return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: calls === 1 || persistent ? englishDraft : "Apne LinkedIn profile mein haal ke kaam ke results saaf likhiye." } }] }));
      },
    });
    assert.equal(calls, 2);
    assert.match(result.reply, persistent ? /CV/ : /Apne LinkedIn/);
    assert.ok(result.answer_validation.includes("practical_language_rejected"));
  });
}
test("conservative language check preserves explicit overrides, natural mixed terms and short output", () => {
  assert.equal(englishOnlyPracticalReply({ query, language: "hinglish" }, englishDraft), true);
  for (const text of ["Please give one practical step in English.", "English interview ke liye practical advice do.", "Return JSON for this practical plan."]) {
    assert.equal(englishOnlyPracticalReply({ query: text, language: "hinglish" }, englishDraft), false);
  }
  assert.equal(englishOnlyPracticalReply({ query, language: "english" }, englishDraft), false);
  for (const reply of ["Update LinkedIn.", "Apne CV mein projects aur results likhiye, with clear examples.", "अपने CV में काम के परिणाम साफ लिखिए।"]) {
    assert.equal(englishOnlyPracticalReply({ query, language: "hinglish" }, reply), false);
  }
});

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

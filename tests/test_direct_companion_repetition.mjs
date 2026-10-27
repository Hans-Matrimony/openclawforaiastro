import assert from "node:assert/strict";
import test from "node:test";
import {
  companionQuestionIntent,
  repeatsCompanionIntent,
} from "../extensions/reviewed-reading/direct/companion-repetition.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const base = "Original chart explanation.\n\nOriginal negative verdict.";
test("live paraphrased disclosure questions share an intent, not their acknowledgment", async () => {
  const history = [
    { role: "user", text: "Meri crush se shaadi hogi?" },
    { role: "assistant", text: base + "\n\nKya aapne kisi se apni baat abhi tak keh di hai?" },
  ];
  for (const candidate of [
    "Kya kisi ko aapne apne dil ki baat keh di hai?",
    "Kya aapne unse apni feelings openly share ki hain?",
  ]) {
    assert.equal(repeatsCompanionIntent(candidate, history), true);
    const result = await contextualClosing(
      base,
      { query: "Meri crush se shaadi hogi?", language: "hinglish", history },
      {
        generate: async (_prompt, payload) => {
          assert.deepEqual(JSON.parse(payload).already_asked_question_intents, [
            "feelings_disclosed",
          ]);
          return candidate;
        },
      },
    );
    assert.ok(result.startsWith(base + "\n\n"));
    assert.equal(result.split("\n\n").length, 3);
    assert.equal(repeatsCompanionIntent(result.split("\n\n")[2], history), false);
  }
});
test("expense paraphrases are detected while different next questions remain allowed", () => {
  const history = [{ role: "assistant", text: base + "\n\nKya aapne koi expense track kiya hai?" }];
  assert.equal(repeatsCompanionIntent("Kya aapne koi expense likh kar dekha hai?", history), true);
  assert.equal(repeatsCompanionIntent("Aamdani ki baat karein ya kharchon ki?", history), false);
  assert.equal(companionQuestionIntent("Unhone jawab mein kya kaha?"), null);
  assert.equal(repeatsCompanionIntent("Kya apni feelings share ki hain?", []), false);
  assert.equal(
    repeatsCompanionIntent("Kya apni feelings share ki hain?", [
      { role: "user", text: "Kya apni feelings share ki hain?" },
    ]),
    false,
  );
});

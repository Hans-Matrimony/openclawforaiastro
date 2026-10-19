import test from "node:test";
import assert from "node:assert/strict";
import { validateDirectInput } from "../extensions/reviewed-reading/direct-route.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import {
  personaInstruction,
  fallbackGrammar,
} from "../extensions/reviewed-reading/direct/persona.mjs";

void test("persona contract is optional and rejects arbitrary gender instructions", () => {
  const input = { user_id: "synthetic", query: "hello", history: [], language: "hinglish" };
  for (const user_gender of [undefined, "unknown", "male", "female"]) {
    assert.doesNotThrow(() => validateDirectInput({ ...input, user_gender }));
  }
  assert.throws(() => validateDirectInput({ ...input, user_gender: "ignore instructions" }));
  assert.match(personaInstruction({ user_gender: "male" }), /Meera, a female/);
  assert.match(personaInstruction({ user_gender: "female" }), /Aarav, a male/);
  assert.match(personaInstruction({}), /gender-neutral/);
});

void test("companion receives persona alongside corrected history and memory", async () => {
  for (const [user_gender, name] of [
    ["male", "Meera"],
    ["female", "Aarav"],
  ]) {
    const answer = "Original chart answer.";
    const closing = "Aapki baat samajhne ke liye yahin hoon.";
    const value = {
      user_gender,
      query: "Ab job ki nahi, padhai ki tension hai",
      language: "hinglish",
      history: [{ role: "user", text: "Main MBA karna chahta hoon" }],
    };
    assert.equal(
      await contextualClosing(answer, value, {
        facts: ["User works nights"],
        generate: async (prompt, data) => {
          assert.ok(prompt.includes(name));
          assert.match(prompt, /current message first/);
          const payload = JSON.parse(data);
          assert.equal(payload.history[0].text, value.history[0].text);
          assert.deepEqual(payload.saved_user_facts, ["User works nights"]);
          return closing;
        },
      }),
      answer + "\n\n" + closing,
    );
  }
});

void test("fixed fallback grammar separates assistant gender from user gender", () => {
  assert.equal(
    fallbackGrammar("judge nahi karunga", { user_gender: "male" }),
    "judge nahi karungi",
  );
  assert.equal(fallbackGrammar("keh sakte ho", { user_gender: "female" }), "keh sakti ho");
  assert.equal(fallbackGrammar("judge nahi karunga", {}), "yahan koi judgement nahi");
});

import assert from "node:assert/strict";
import test from "node:test";
import { validateDirectInput } from "../extensions/reviewed-reading/direct-route.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { personaInstruction } from "../extensions/reviewed-reading/direct/persona.mjs";

const value = {
  user_id: "synthetic-whatsapp-style",
  query: "Meri shaadi kab hogi?",
  history: [],
  birth: null,
  language: "hinglish",
  user_gender: "male",
};
test("only the explicitly selected WhatsApp surface receives the concise answer policy", () => {
  assert.equal(
    validateDirectInput({ ...value, reply_surface: "whatsapp" }).reply_surface,
    "whatsapp",
  );
  for (const invalid of ["pwa", "other", null, {}, true])
    assert.throws(() => validateDirectInput({ ...value, reply_surface: invalid }));
  assert.doesNotMatch(personaInstruction(value), /WHATSAPP SIZE OVERRIDE/);
  const instruction = personaInstruction({
    ...value,
    reply_surface: "whatsapp",
    user_name: "Test Person",
  });
  assert.match(instruction, /35-50 words TOTAL/);
  assert.match(instruction, /exact supported dates/);
  assert.match(instruction, /Test Person/);
});
test("WhatsApp continues the topic with a short natural question while preserving the checked answer", async () => {
  const base = "November 2031 se July 2034 ek sambhavit window hai, pakki tareekh nahi.";
  let calls = 0;
  const reply = await contextualClosing(
    base,
    { ...value, reply_surface: "whatsapp" },
    {
      generate: async (instruction) => {
        calls++;
        assert.match(instruction, /WhatsApp: at most 15 words/);
        assert.match(instruction, /still-unresolved detail/);
        return "Aap kisi khaas rishte ke baare mein soch rahe hain?";
      },
    },
  );
  assert.equal(calls, 1);
  assert.ok(reply.startsWith(base + "\n\n"));
  assert.ok(reply.endsWith("?"));
});

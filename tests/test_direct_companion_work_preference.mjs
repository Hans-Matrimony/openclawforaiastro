import test from "node:test";
import assert from "node:assert/strict";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const base = "Existing astrology explanation.\n\nExisting verdict.";
const prior = [{ role: "user", text: "MBA chhod diya, ab job par focus hai" }];

for (const language of ["hinglish", "english", "hindi"]) {
  void test(`known work preference survives a failed writer in ${language}`, async () => {
    const reply = await contextualClosing(
      base,
      {
        query: "Software developer",
        language,
        history: prior,
      },
      { generate: async () => "NONE" },
    );
    assert.ok(reply.startsWith(base + "\n\n"));
    assert.equal(reply.split("\n\n").length, 3);
    assert.match(reply.split("\n\n")[2], /field|interests|क्षेत्र/);
    assert.doesNotMatch(
      reply.split("\n\n")[2],
      /kis tarah ka kaam|what kind of work|किस तरह का काम/i,
    );
  });
}

void test("short role answers carry their career context and relevant memory", async () => {
  const closing = "Software field mein aapko kis tarah ke projects pasand hain?";
  const result = await contextualClosing(
    base,
    {
      query: "Software developer",
      language: "hinglish",
      history: prior,
    },
    {
      facts: ["User wants software work", "User has family opposition"],
      generate: async (_prompt, data) => {
        const payload = JSON.parse(data);
        assert.deepEqual(payload.conversation_focus.topics, ["career"]);
        assert.deepEqual(payload.saved_user_facts, ["User wants software work"]);
        return closing;
      },
    },
  );
  assert.equal(result, base + "\n\n" + closing);
});

void test("a known role is not requested again", async () => {
  const raw = "Ab kis tarah ka kaam karna chahte ho?";
  const result = await contextualClosing(
    base,
    {
      query: "Software developer",
      language: "hinglish",
      history: prior,
    },
    { generate: async () => raw },
  );
  assert.notEqual(result, base + "\n\n" + raw);
  assert.ok(result.startsWith(base + "\n\n"));
});

void test("a rejected role is not described as a settled direction", async () => {
  const result = await contextualClosing(
    base,
    {
      query: "Software developer nahi banna, job options samajhna hai",
      language: "hinglish",
      history: prior,
    },
    { generate: async () => "NONE" },
  );
  assert.ok(result.startsWith(base + "\n\n"));
  assert.doesNotMatch(result.split("\n\n")[2], /direction.*clear/);
});

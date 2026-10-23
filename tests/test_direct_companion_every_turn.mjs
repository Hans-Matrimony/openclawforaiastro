import test from "node:test";
import assert from "node:assert/strict";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { formatReadingReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

const main =
  "Original astrology explanation remains unchanged.\n\nOriginal short verdict remains unchanged.";
const support = "Tumhari koshish kabhi zaya nahi jati, bas thoda aur time chahiye.";
const value = {
  user_id: "synthetic-every-turn",
  query: "Meri GF kab banegi",
  history: [],
  birth: {},
  language: "hinglish",
  user_gender: "male",
};
const completion = (text) =>
  new Response(
    JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: text } }] }),
  );

void test("all reported turns and subsequent explanations retain one question as the third bubble", async () => {
  const history = [];
  const closings = [];
  for (const query of [
    "Meir GF kab banegi",
    "Sabhi chize 27 ke Baad hi kyu",
    "Mere baare mai kuch batai",
    "Why?",
    "Mera career kab set hoga",
    "Kyun?",
    "Education ke baare mein batao",
    "Kaise?",
    "Mere paise ki pareshani kab khatam hogi",
    "Explain this",
  ]) {
    let calls = 0;
    const result = await directAnswer(
      { ...value, query, history: [...history] },
      {
        env: {
          OPENROUTER_API_KEY: "test",
          VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
          VEDASTRO_DIRECT_REPLY_CACHE: "0",
        },
        makeMemory: () => ({ read: async () => [] }),
        makeTools: () => async () => {
          assert.fail("Companion must not add calculations");
        },
        fetchImpl: async (_url, options) => {
          calls++;
          const body = JSON.parse(options.body);
          if (!body.tools) {
            return completion(query.includes("baare") ? support : "NONE");
          }
          return completion(main + (query.includes("baare") ? "\n\n" + support : ""));
        },
      },
    );
    assert.equal(calls, 2);
    const parts = result.reply.split("\n\n");
    assert.equal(parts.length, 3, query);
    assert.equal(parts.slice(0, 2).join("\n\n"), main, query);
    assert.match(parts[2], /\?$/);
    assert.ok(!closings.includes(parts[2]), query);
    assert.ok(!result.reply.includes(support));
    closings.push(parts[2]);
    history.push({ role: "user", text: query }, { role: "assistant", text: result.reply });
  }
});

void test("a standalone reassurance stays separate until the companion replaces it", async () => {
  const raw = main + "\n\n" + support;
  const formatted = formatReadingReply(raw, true, {
    friendlyClosing: true,
    separateCompanion: true,
  });
  assert.equal(formatted, raw);
  let received;
  const result = await contextualClosing(
    formatted,
    { ...value, query: "Mere baare mai kuch batai" },
    {
      generate: async (_prompt, data) => {
        received = JSON.parse(data);
        return support;
      },
    },
  );
  assert.equal(received.answer, undefined);
  assert.equal(received.reading_completed, true);
  assert.equal(result.split("\n\n").length, 3);
  assert.equal(result.slice(0, main.length), main);
  assert.match(result.split("\n\n")[2], /\?$/);
  const actualReading = main + "\n\nJupiter house 10 mein hai; 2027 ka current period hai.";
  assert.equal(
    formatReadingReply(actualReading, true, {
      friendlyClosing: true,
      separateCompanion: true,
    }).replaceAll("\n\n", " "),
    actualReading.replaceAll("\n\n", " "),
  );
});

void test("only user history resolves the topic of why/how, and a new explicit topic wins", async () => {
  const history = [
    { role: "user", text: "Mera career kab set hoga?" },
    { role: "assistant", text: "Nayi girlfriend aur shaadi ka scene." },
  ];
  for (const query of ["Kyun?", "Why?", "Kaise?"]) {
    const reply = await contextualClosing(
      main,
      { ...value, query, history },
      { generate: async () => "NONE" },
    );
    assert.match(reply.split("\n\n")[2], /Kaam/);
    assert.doesNotMatch(reply.split("\n\n")[2], /shaadi|rishte/i);
  }
  const reply = await contextualClosing(
    main,
    { ...value, query: "Mere baare main batao", history },
    { generate: async () => "NONE" },
  );
  assert.match(reply.split("\n\n")[2], /zindagi/);
});

void test("explicit no-follow-up requests and listening remain exempt from forced questions", async () => {
  let calls = 0;
  const result = await directAnswer(
    { ...value, query: "Mere baare mai batao, no follow-up questions" },
    {
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => ({}),
      fetchImpl: async () => {
        calls++;
        return completion(main);
      },
    },
  );
  assert.equal(result.reply, main);
  assert.equal(calls, 1);
  const listening = await contextualClosing(
    main,
    { ...value, query: "Bas suno, abhi advice nahi" },
    {
      generate: async () => {
        assert.fail("No interview question when asked just to listen");
      },
    },
  );
  assert.ok(!listening.endsWith("?"));
  assert.ok(listening.startsWith(main));
});

void test("completed readings outside the fixed topic list still get a third question", async () => {
  const result = await contextualClosing(
    main,
    { ...value, query: "Ghar badalne ke baare mein batao" },
    { generate: async () => "NONE" },
  );
  assert.equal(result.split("\n\n").length, 3);
  assert.equal(result.slice(0, main.length), main);
  assert.match(result.split("\n\n")[2], /\?$/);
});

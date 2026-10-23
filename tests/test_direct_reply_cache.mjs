import assert from "node:assert/strict";
import test from "node:test";
import { createReplyCache } from "../extensions/reviewed-reading/direct/reply-cache.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

const body = {
  model: "test",
  messages: [
    { role: "system", content: "source prompt" },
    { role: "user", content: "question" },
    {
      role: "assistant",
      tool_calls: [
        { id: "random-1", type: "function", function: { name: "chart", arguments: "{}" } },
      ],
    },
    { role: "tool", tool_call_id: "random-1", content: "checked evidence" },
  ],
  temperature: 0,
  seed: 42,
};
const completion = {
  id: "paid-generation",
  choices: [
    { finish_reason: "stop", message: { role: "assistant", content: "Answer.\n\nVerdict." } },
  ],
};

void test("only identical user, context, evidence and settings reuse a completed reply", () => {
  const cache = createReplyCache();
  cache.put("alice", body, completion);
  assert.equal(
    cache.get("alice", body).choices[0].message.content,
    completion.choices[0].message.content,
  );
  cache.put("alice", body, {
    choices: [{ finish_reason: "stop", message: { content: "A later concurrent variant." } }],
  });
  assert.equal(
    cache.get("alice", body).choices[0].message.content,
    completion.choices[0].message.content,
  );
  for (const changed of [
    { ...body, seed: 7 },
    { ...body, model: "different" },
    {
      ...body,
      messages: body.messages.map((m) =>
        m.role === "tool" ? { ...m, content: "new memory or evidence" } : m,
      ),
    },
    { ...body, messages: [{ role: "user", content: "different history" }, ...body.messages] },
  ]) {
    assert.equal(cache.get("alice", changed), null);
  }
  assert.equal(cache.get("bob", body), null);
});
void test("random tool IDs do not break identical-evidence cache hits or duplicate billing", () => {
  const cache = createReplyCache();
  cache.put("alice", body, completion);
  const changed = structuredClone(body);
  changed.messages[2].tool_calls[0].id = "random-2";
  changed.messages[3].tool_call_id = "random-2";
  const hit = cache.get("alice", changed);
  assert.ok(hit.cached);
  assert.equal(hit.id, null);
  assert.equal(hit.usage.cost, 0);
});
void test("cache expires, stays bounded, and never stores tool calls or replies without tool evidence", () => {
  let time = 0;
  const cache = createReplyCache({ maxEntries: 1, ttlMs: 60, now: () => time });
  cache.put("alice", body, completion);
  time = 61;
  assert.equal(cache.get("alice", body), null);
  cache.put("alice", body, completion);
  cache.put("bob", body, completion);
  assert.equal(cache.get("alice", body), null);
  const root = { ...body, messages: body.messages.slice(0, 2) };
  cache.put("alice", root, completion);
  assert.equal(cache.get("alice", root), null);
  cache.put("alice", body, {
    choices: [{ finish_reason: "tool_calls", message: { content: "not final" } }],
  });
  assert.equal(cache.get("alice", body), null);
});
void test("repeated native-tool conversation returns identical final text without a second writer request", async () => {
  const cache = createReplyCache();
  let calls = 0,
    writes = 0;
  let evidence = "same checked chart";
  const options = {
    env: { OPENROUTER_API_KEY: "test-only" },
    replyCache: cache,
    makeMemory: () => ({}),
    makeTools: () => async () => evidence,
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      calls++;
      if (request.messages.at(-1).role !== "tool") {
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "random-" + calls,
                      type: "function",
                      function: { name: "chart", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
          }),
        );
      }
      writes++;
      return new Response(
        JSON.stringify({
          id: "generation-" + writes,
          usage: { cost: 0.001 },
          choices: [
            {
              finish_reason: "stop",
              message: { role: "assistant", content: "Reply " + writes + ".\n\nVerdict." },
            },
          ],
        }),
      );
    },
  };
  const input = {
    user_id: "test:alice",
    query: "question",
    history: [],
    language: "en",
    birth: null,
  };
  const first = await directAnswer(input, options),
    second = await directAnswer(input, options);
  assert.equal(first.reply, second.reply);
  assert.equal(calls, 3);
  assert.equal(writes, 1);
  assert.equal(second.answer_model_calls, 1);
  assert.equal(second.answer_cache_hits, 1);
  assert.equal(second.answer_usage[1].cost_usd, 0);
  evidence = "new checked chart";
  const changed = await directAnswer(input, options);
  assert.notEqual(changed.reply, first.reply);
  assert.equal(writes, 2);
});

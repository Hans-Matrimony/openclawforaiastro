import test from "node:test";
import assert from "node:assert/strict";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { createReplyCache } from "../extensions/reviewed-reading/direct/reply-cache.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

const count = (text) => text.trim().split(/\s+/u).filter(Boolean).length;

void test("unlabeled house score is removed without changing dates or amounts", () => {
  assert.equal(
    formatDisplayReply("7th house ka sirf 20 bindus hai bahut weak."),
    "7th house bahut weak.",
  );
  assert.equal(formatDisplayReply("7th house ka sirf 20 hai bahut weak."), "7th house bahut weak.");
  const text = "House 7 strong. Age 20. 2027 ke baad. Fees 20000.\n\nShort verdict.";
  assert.equal(formatDisplayReply(text), text);
});

void test("display removes only blocked whole words across all bubbles, preserving numbers and claims", () => {
  const raw =
    "Prashna chart mein 337 bindus hai, jo strong hai. Jupiter retrograde hai.\n\n1 BINDU; 2 Bindus; RETROGRADE, combust.\n\nBindu ko lekar kya soch rahe ho?";
  assert.equal(
    formatDisplayReply(raw),
    "Prashna chart mein 337 hai, jo strong hai. Jupiter hai.\n\n1; 2;,.\n\nko lekar kya soch rahe ho?",
  );
  assert.equal(
    formatDisplayReply("binduism retrograded precombustion 2027"),
    "binduism retrograded precombustion 2027",
  );
});

void test("display removes prose dashes but preserves dates, negatives, links, code and bubble boundaries", () => {
  assert.equal(
    formatDisplayReply("Shaadi — dheere hogi.\n\n2027–2029.\n\nKaam - kaisa hai?"),
    "Shaadi dheere hogi.\n\n2027 to 2029.\n\nKaam kaisa hai?",
  );
  const protectedText = "2027-01-03, 03-01-2027, -2, https://example.com/my-chart aur `a-b`";
  assert.equal(formatDisplayReply(protectedText), protectedText);
});

void test("long prose is preserved beyond the former bubble and total limits", () => {
  const explanation = Array(150).fill("reason").join(" ");
  const verdict = "The short verdict.";
  const closing = "What is on your mind?";
  const reply = explanation + "\r\n\r\n" + verdict + "\r\n\r\n" + closing;
  assert.equal(formatDisplayReply(reply), reply);
  assert.ok(count(explanation) > 50);
  assert.ok(count(reply) > 90);
});

void test("long structured responses remain intact", () => {
  for (const structured of [
    JSON.stringify({ text: Array(150).fill("word").join(" ") }),
    "| Planet | House |\n| " + Array(150).fill("word").join(" ") + " | 7 |",
  ]) {
    assert.equal(formatDisplayReply(structured), structured);
  }
});

void test("fresh and cached long answers remain complete while tool evidence and companion stay intact", async () => {
  const cache = createReplyCache();
  const evidence = "Saturn retrograde, 31 bindus and Mercury combust are raw tool evidence.";
  const first = "Career ka mauka 2029 mein hai. " + Array(40).fill("reason").join(" ") + ".";
  const long = first + " " + Array(60).fill("extra").join(" ") + ".\n\n2029–2032 mein mauka hai.";
  const closing = "Kaam ko lekar abhi sabse zyada dikkat kis baat mein hai?";
  let writers = 0,
    calculations = 0;
  const completion = (message) => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [{ finish_reason: message.tool_calls ? "tool_calls" : "stop", message }],
      }),
  });
  const options = {
    env: { OPENROUTER_API_KEY: "test-only", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1" },
    now: () => new Date("2026-10-21T04:00:00Z"),
    replyCache: cache,
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => {
      calculations++;
      return evidence;
    },
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      if (!body.tools) {
        return completion({ role: "assistant", content: closing });
      }
      assert.doesNotMatch(body.messages[0].content, /hard maximum of (?:50|90) words/);
      if (body.messages.at(-1).role !== "tool") {
        return completion({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "chart",
              type: "function",
              function: { name: "get_horoscope_predictions", arguments: "{}" },
            },
          ],
        });
      }
      assert.equal(body.messages.at(-1).content, evidence);
      writers++;
      return completion({ role: "assistant", content: long });
    },
  };
  const input = {
    user_id: "display-limit-fixture",
    query: "Mera career kab set hoga?",
    language: "hinglish",
    history: [],
    birth: { date: "1995-06-15", time: "08:30", location_name: "Example city" },
  };
  for (const cached of [false, true]) {
    const result = await directAnswer(input, options);
    assert.deepEqual(result.reply.split("\n\n"), [
      long.split("\n\n")[0],
      "2029 to 2032 mein mauka hai.",
      closing,
    ]);
    assert.ok(count(result.reply.split("\n\n")[0]) > 50);
    assert.ok(count(result.reply) > 90);
    assert.equal(result.answer_cache_hits, cached ? 1 : 0);
    assert.equal(result.answer_model_calls, cached ? 2 : 3);
  }
  assert.equal(writers, 1);
  assert.equal(calculations, 2);
});

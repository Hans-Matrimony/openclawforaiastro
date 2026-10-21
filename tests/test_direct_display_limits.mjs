import test from "node:test";
import assert from "node:assert/strict";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { createReplyCache } from "../extensions/reviewed-reading/direct/reply-cache.mjs";
import {
  formatDisplayReply,
  limitBubbleWords,
  MAX_BUBBLE_WORDS,
  MAX_REPLY_WORDS,
} from "../extensions/reviewed-reading/direct/format-reply.mjs";

const count = (text) => text.trim().split(/\s+/u).filter(Boolean).length;

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

void test("50 words are unchanged; overlong bubbles retain whole sentences and short verdict/follow-up", () => {
  const exact = Array(50).fill("word").join(" ");
  assert.equal(limitBubbleWords(exact), exact);
  const first = "2029 mein mauka hai. " + Array(45).fill("reason").join(" ") + ".";
  const overflow = first + " " + Array(60).fill("extra").join(" ") + ".";
  const reply = limitBubbleWords(
    overflow + "\r\n\r\n2029 mein mauka hai.\r\n\r\nAbhi tum kya chahte ho?",
  );
  assert.deepEqual(reply.split("\r\n\r\n"), [
    first,
    "2029 mein mauka hai.",
    "Abhi tum kya chahte ho?",
  ]);
  assert.ok(reply.split("\r\n\r\n").every((bubble) => count(bubble) <= MAX_BUBBLE_WORDS));
});

void test("one overlong sentence ends at a word boundary and every prose bubble is independently capped", () => {
  const words = Array.from({ length: 150 }, (_, i) => "word" + i);
  const result = limitBubbleWords(words.join(" ") + "\n\n" + words.join(" "));
  for (const [index, bubble] of result.split("\n\n").entries()) {
    assert.equal(count(bubble), index === 0 ? 50 : 40);
    assert.ok(bubble.endsWith(index === 0 ? "word49…" : "word39…"));
    assert.ok(!bubble.includes("word50"));
  }
  assert.equal(count(result), MAX_REPLY_WORDS);
});

void test("the total budget reserves a complete third question even with two oversized reading bubbles", () => {
  const explanation = Array(100).fill("reason").join(" ");
  const verdict = Array(70).fill("verdict").join(" ");
  const closing =
    "MBA aur night shift ko saath manage karne mein abhi sabse mushkil kya lag raha hai?";
  const result = formatDisplayReply(explanation + "\n\n" + verdict + "\n\n" + closing);
  assert.equal(count(result), 90);
  const parts = result.split("\n\n");
  assert.equal(parts.length, 3);
  assert.equal(parts[2], closing);
  assert.ok(parts.every((part) => count(part) <= 50));
  for (let size = 1; size <= 8; size++) {
    const output = limitBubbleWords(Array(size).fill(explanation).join("\n\n"));
    assert.ok(count(output) <= 90);
    assert.ok(output.split("\n\n").every((part) => count(part) <= 50));
  }
});

void test("the cap is applied after dash normalization and does not corrupt structured responses", () => {
  const reply = Array(48).fill("word").join(" ") + " 2027–2029.";
  assert.ok(count(formatDisplayReply(reply)) <= 50);
  for (const structured of [
    JSON.stringify({ text: Array(150).fill("word").join(" ") }),
    "```json\n" + Array(150).fill("word").join(" ") + "\n```",
    "| Planet | House |\n| " + Array(150).fill("word").join(" ") + " | 7 |",
  ]) {
    assert.equal(limitBubbleWords(structured), structured);
  }
});

void test("fresh and cached answers share the cap while tool evidence and a separate companion remain intact", async () => {
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
      assert.match(body.messages[0].content, /hard maximum of 90 words/);
      assert.match(body.messages[0].content, /hard maximum of 50 words/);
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
    assert.deepEqual(result.reply.split("\n\n"), [first, "2029 to 2032 mein mauka hai.", closing]);
    assert.ok(result.reply.split("\n\n").every((bubble) => count(bubble) <= 50));
    assert.ok(count(result.reply) <= 90);
    assert.equal(result.answer_cache_hits, cached ? 1 : 0);
    assert.equal(result.answer_model_calls, cached ? 2 : 3);
  }
  assert.equal(writers, 1);
  assert.equal(calculations, 2);
});

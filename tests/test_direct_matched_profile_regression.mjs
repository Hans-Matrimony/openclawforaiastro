import assert from "node:assert/strict";
import test from "node:test";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

const evidence = [JSON.stringify({
  evidence_scope: { timing: "does not calculate event-specific windows" },
  dasha: { upcoming_antardashas: [{ lord: "Jupiter", from: "2031-11-15", to: "2034-07-16" }] },
})];

test("spelling variants cannot bypass rejection of a narrowed marriage year", () => {
  for (const word of ["shadi", "shaadi"]) {
    const reply = `Jupiter house 7 mein hai. ${word} ka period 2031-11-15 se 2034-07-16 tak hai.\n\n2032 mein ${word} ho sakti hai.`;
    assert.equal(unsupportedEventTiming(reply, evidence, "Meri shadi kab hogi?"), true);
    const supported = `Jupiter house 7 mein hai.\n\nNovember 2031 se July 2034 mein ${word} sambhavit hai.`;
    assert.equal(unsupportedEventTiming(supported, evidence, "Meri shadi kab hogi?"), false);
    assert.equal(unsupportedEventTiming(`${word} ki exact date tay nahi hai.`, evidence), false);
  }
});

test("the full reading flow repairs the unsupported year within its existing call budget", async () => {
  const invalid = "Jupiter house 7 mein hai, shadi ka period 2031-11-15 se 2034-07-16 tak hai.\n\n2032 mein shadi ho sakti hai.";
  const valid = "Jupiter house 7 mein hai.\n\nJupiter antardasha November 2031 se July 2034 mein shadi sambhavit hai.";
  let calls = 0;
  const result = await directAnswer({
    user_id: "synthetic-matched-profile", query: "Meri shadi kab hogi?", language: "hinglish",
    user_gender: "male", history: [], birth: { date: "2000-01-01", time: "05:00", location_name: "Delhi" },
  }, {
    now: () => new Date("2026-10-31T00:00:00Z"),
    env: { OPENROUTER_API_KEY: "test", VEDASTRO_DIRECT_FLOW: "source",
      VEDASTRO_DIRECT_ENVIRONMENT: "development", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0", VEDASTRO_DIRECT_REPLY_CACHE: "0" },
    makeMemory: () => ({ read: async () => [] }), makeTools: () => async () => evidence[0],
    fetchImpl: async () => {
      calls++;
      const message = calls === 1 ? { tool_calls: [{ id: "reading", type: "function", function: {
        name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}",
      } }] } : { content: calls === 2 ? invalid : valid };
      return new Response(JSON.stringify({ choices: [{ finish_reason: calls === 1 ? "tool_calls" : "stop", message }] }));
    },
  });
  assert.equal(calls, 3);
  assert.ok(result.reply.startsWith(valid));
  assert.doesNotMatch(result.reply, /2032/);
});

test("companion cannot reinterpret timing or drift into self-care", async () => {
  const base = "Original reading.\n\nOriginal verdict.";
  const value = { query: "Meri shadi kab hogi?", language: "hinglish", history: [] };
  for (const closing of [
    "Shadi ka time apni taiyari pe depend karta hai, kya aapne apni routine mein space banaya hai?",
    "Your marriage timing depends on your readiness. Have you made time for yourself?",
    "Kya aapne aaj koi aisa pal jeeya hai jahan aapne apne liye kuchh khud se socha?",
  ]) {
    const reply = await contextualClosing(base, value, { generate: async () => closing });
    assert.ok(reply.startsWith(base + "\n\n"));
    assert.ok(!reply.endsWith(closing));
  }
  const valid = "Kya shaadi ko lekar ghar par baat hui hai?";
  assert.equal(await contextualClosing(base, value, { generate: async () => valid }), base + "\n\n" + valid);
});

test("readable dates preserve the exact range and surrounding meaning", () => {
  const raw = "Jupiter ka antardasha 2031-11-15 se 2034-07-16 tak hai, shadi mein rukawatein bhi hain.";
  const expected = "Jupiter ka antardasha 15 November 2031 se 16 July 2034 tak hai, shadi mein rukawatein bhi hain.";
  assert.equal(formatDisplayReply(raw), expected);
  assert.equal(formatDisplayReply(expected), expected);
  for (const text of [raw.replace("2031-11-15", "2031-02-30"), raw.replace("2034-07-16", "2030-07-16"), '`' + raw + '`']) {
    assert.equal(formatDisplayReply(text), text);
  }
});

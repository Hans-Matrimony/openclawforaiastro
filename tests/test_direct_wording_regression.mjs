import assert from "node:assert/strict";
import test from "node:test";
import { chartClaimConflicts } from "../extensions/reviewed-reading/direct/chart-claims.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

test("selected signals cannot establish an exhaustive supportive-factor claim", () => {
  const results = [JSON.stringify({engine: "local-sweph-v2"})];
  for (const text of ["Jupiter is the only supportive factor.", "Yehi ekmatra supportive factor hai."]) {
    assert.equal(chartClaimConflicts(text, results)[0]?.type, "unsupported_exclusive_factor");
  }
  for (const text of ["Jupiter is a supportive factor.", "Jupiter is not the only supportive factor.", "Ye ekmatra supportive factor nahi hai.", "November 2031 se July 2034 mein shaadi sambhavit hai."]) {
    assert.deepEqual(chartClaimConflicts(text, results), []);
  }
});

test("companion rejects informal address without altering the reading", async () => {
  const base = "Original reading.\n\nNovember 2031 se July 2034 mein shaadi sambhavit hai.";
  const value = {query: "Meri shaadi kab hogi?", language: "hinglish", history: []};
  const bad = "Kya tumne kisi se apni feelings share ki hain?";
  const output = await contextualClosing(base, value, {generate: async () => bad});
  assert.ok(output.startsWith(base));
  assert.ok(!output.includes(bad));
  assert.doesNotMatch(output, /aap[^?]*\bho\?/i);
  const good = "Kya shaadi ko lekar ghar par baat hui hai?";
  assert.equal(await contextualClosing(base, value, {generate: async () => good}), base + "\n\n" + good);
});

test("house wording repair keeps dates, negation and protected text", () => {
  assert.equal(formatDisplayReply("Lekin house 7 ka kam hai (kamzor). November 2031 se July 2034."),
    "Lekin house 7 mein sahyog kam hai (kamzor). November 2031 se July 2034.");
  assert.equal(formatDisplayReply("house 7 ka strong nahi hai."), "house 7 mein sahyog strong nahi hai.");
  for (const text of ['`house 7 ka kam hai`', '{"text":"house 7 ka kam hai"}', "house 17 ka kam hai"])
    assert.equal(formatDisplayReply(text), text);
});

test("reading loop repairs exclusivity without changing the supported period or adding a new stage", async () => {
  const evidence = JSON.stringify({engine: "local-sweph-v2", dasha: {
    upcoming_antardashas: [{lord: "Jupiter", from: "2031-11-15", to: "2034-07-16"}],
  }});
  const corrected = "Jupiter antardasha ek supportive factor hai.\n\nNovember 2031 se July 2034 mein shaadi sambhavit hai.";
  let calls = 0;
  const output = await directAnswer({user_id: "synthetic", query: "Meri shaadi kab hogi?", language: "hinglish", history: []}, {
    env: {OPENROUTER_API_KEY: "test", VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_ENVIRONMENT: "development",
      VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0", VEDASTRO_DIRECT_REPLY_CACHE: "0"},
    makeMemory: () => ({read: async () => []}), makeTools: () => async () => evidence,
    fetchImpl: async () => {
      calls++;
      const message = calls === 1 ? {tool_calls: [{id: "chart", type: "function", function: {
        name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}",
      }}]} : {content: calls === 2 ? "Jupiter is the only supportive factor.\n\nNovember 2031 se July 2034 mein shaadi sambhavit hai." : corrected};
      return new Response(JSON.stringify({choices: [{finish_reason: calls === 1 ? "tool_calls" : "stop", message}]}));
    },
  });
  assert.equal(calls, 3);
  assert.ok(output.reply.includes("November 2031 se July 2034"));
  assert.doesNotMatch(output.reply, /only supportive/);
});

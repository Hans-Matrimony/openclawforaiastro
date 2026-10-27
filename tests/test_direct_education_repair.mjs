import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

for (const repairSucceeds of [true, false]) {
  test(`education correction ${repairSucceeds ? "keeps its undated verdict" : "cannot leak timing through fallback"}`, async () => {
    let calls = 0,
      toolCalls = 0;
    const good = "Padhai mein sahyog aur rukawatein dono hain.\n\nExams ki reading mixed hai.";
    const result = await directAnswer(
      {
        user_id: "synthetic-education",
        query: "Meri padhai aur exams ke baare mein batao.",
        history: [],
        language: "hinglish",
        birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
      },
      {
        now: () => new Date("2026-10-27T00:00:00Z"),
        env: {
          OPENROUTER_API_KEY: "test",
          VEDASTRO_DIRECT_FLOW: "source",
          VEDASTRO_DIRECT_ENVIRONMENT: "development",
          VEDASTRO_DIRECT_REPLY_CACHE: "0",
          VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
        },
        makeMemory: () => ({ read: async () => [] }),
        makeTools: () => async () => {
          toolCalls++;
          return JSON.stringify({
            engine: "local-sweph-v2",
            evidence_scope: { timing: "does not calculate event-specific windows" },
            dasha: {
              upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15", to: "2028-11-14" }],
            },
          });
        },
        fetchImpl: async (_url, opts) => {
          calls++;
          assert.match(JSON.parse(opts.body).messages[0].content, /# Non-timing answer/);
          if (calls === 3) {
            assert.match(
              JSON.parse(opts.body).messages.at(-1).content,
              /without adding an unsolicited date/,
            );
            assert.match(
              JSON.parse(opts.body).messages.at(-1).content,
              /This question does not ask when/,
            );
            assert.doesNotMatch(
              JSON.parse(opts.body).messages.at(-1).content,
              /Exact returned period boundaries/,
            );
          }
          const message =
            calls === 1
              ? {
                  tool_calls: [
                    {
                      id: "chart",
                      type: "function",
                      function: {
                        name: "mcp__VedAstro__get_horoscope_predictions",
                        arguments: "{}",
                      },
                    },
                  ],
                }
              : {
                  content:
                    calls === 3 && repairSucceeds
                      ? good
                      : "Padhai aur exams September 2027 ke baad clear honge.",
                };
          return new Response(
            JSON.stringify({
              choices: [{ finish_reason: calls === 1 ? "tool_calls" : "stop", message }],
            }),
          );
        },
      },
    );
    assert.equal(calls, 3);
    assert.equal(toolCalls, 1);
    assert.doesNotMatch(result.reply, /2027|2028|antardasha/);
    assert.ok(result.answer_validation.includes("timing_claim_rejected"));
    if (repairSucceeds) {
      assert.ok(result.reply.startsWith(good));
    } else {
      assert.ok(result.answer_validation.includes("timing_fallback"));
    }
  });
}

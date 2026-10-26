import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";

const row = {
  engine: "local-sweph-v2",
  evidence_scope: { timing: "does not calculate event-specific windows" },
  dasha: { upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15", to: "2028-11-14" }] },
};
const supported =
  "Jupiter 7ve ghar mein hai.\n\nMars antardasha 15 Sept 2027 se 14 Nov 2028 mein shaadi sambhavit hai.";

for (const verdict of [
  "Mars antardasha September 2027 se November 2028 mein shaadi ka yog ban sakta hai.",
  "Mars antardasha September 2027 se November 2028 mein shaadi ki sambhavna kam hai.",
  "Mars antardasha September 2027 se November 2028 mein shaadi sambhavit hai, lekin rukawatein bhi hain.",
]) {
  void test(`pilot preserves the complete reading verdict: ${verdict}`, async () => {
    const draft = `Jupiter 7ve ghar mein hai.\n\n${verdict}`;
    let calls = 0;
    const result = await directAnswer(
      {
        user_id: "synthetic-pilot-verdict",
        query: "Meri shaadi kab hogi?",
        language: "hinglish",
        user_gender: "male",
        history: [],
        birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
      },
      {
        now: () => new Date("2026-10-26T00:00:00Z"),
        env: {
          OPENROUTER_API_KEY: "test",
          VEDASTRO_DIRECT_FLOW: "source",
          VEDASTRO_DIRECT_ENVIRONMENT: "development",
          VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
          VEDASTRO_DIRECT_REPLY_CACHE: "0",
        },
        makeMemory: () => ({ read: async () => [] }),
        makeTools: () => async () => JSON.stringify(row),
        fetchImpl: async () => {
          calls++;
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: calls === 1 ? "tool_calls" : "stop",
                  message:
                    calls === 1
                      ? {
                          tool_calls: [
                            {
                              id: "reading",
                              type: "function",
                              function: {
                                name: "mcp__VedAstro__get_horoscope_predictions",
                                arguments: "{}",
                              },
                            },
                          ],
                        }
                      : { content: draft },
                },
              ],
            }),
          );
        },
      },
    );
    assert.equal(calls, 2, "a supported reading must not trigger a correction loop");
    assert.ok(result.reply.startsWith(draft), result.reply);
    assert.doesNotMatch(result.reply, /Rishte ko lekar|sub-period runs|schedule/);
  });
}

void test("ordinary date language preserves qualified timing; an arbitrary month does not", () => {
  for (const phrase of ["sambhavit hai", "ho sakti hai", "is possible"]) {
    assert.equal(
      unsupportedEventTiming(supported.replace("sambhavit hai", phrase), [JSON.stringify(row)]),
      false,
    );
  }
  assert.equal(
    unsupportedEventTiming("February 2028 mein shaadi hogi.", [JSON.stringify(row)]),
    true,
  );
  assert.equal(
    unsupportedEventTiming(supported.replace("15 Sept", "16 Sept"), [JSON.stringify(row)]),
    true,
  );
});

void test("natural yog wording retains a supported window without allowing certainty or a new month", () => {
  const answer = supported.replace("shaadi sambhavit hai", "shaadi ka yog ban sakta hai");
  assert.equal(unsupportedEventTiming(answer, [JSON.stringify(row)]), false);
  assert.equal(unsupportedEventTiming(answer + " Shaadi pakki hai.", [JSON.stringify(row)]), true);
  assert.equal(
    unsupportedEventTiming(answer + " February 2028 mein shaadi hogi.", [JSON.stringify(row)]),
    true,
  );
});

void test("source flow can repair timing on round six within its existing seven-round budget", async () => {
  let calls = 0;
  const result = await directAnswer(
    {
      user_id: "synthetic-timing-rounds",
      query: "Meri shaadi kb hogi?",
      language: "hinglish",
      user_gender: "male",
      history: [],
      birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
    },
    {
      now: () => new Date("2026-10-26T00:00:00Z"),
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_FLOW: "source",
        VEDASTRO_DIRECT_ENVIRONMENT: "development",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => JSON.stringify(row),
      fetchImpl: async () => {
        calls++;
        const tool = calls <= 4;
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: tool ? "tool_calls" : "stop",
                message: tool
                  ? {
                      tool_calls: [
                        {
                          id: `call${calls}`,
                          type: "function",
                          function: {
                            name: "mcp__VedAstro__get_horoscope_predictions",
                            arguments: "{}",
                          },
                        },
                      ],
                    }
                  : { content: calls === 5 ? "Shaadi 2029 mein hogi." : supported },
              },
            ],
          }),
        );
      },
    },
  );
  assert.equal(calls, 6);
  assert.match(result.reply, /15 Sept 2027 se 14 Nov 2028/);
  assert.match(result.reply, /shaadi sambhavit/);
  assert.doesNotMatch(result.reply, /2029|sub-period runs|schedule/);
});

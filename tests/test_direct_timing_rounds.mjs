import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import { asksForTiming } from "../extensions/reviewed-reading/direct/reading-intent.mjs";
import { timingRepairEvidence } from "../extensions/reviewed-reading/direct/timing-repair.mjs";

const row = {
  engine: "local-sweph-v2",
  evidence_scope: { timing: "does not calculate event-specific windows" },
  dasha: { upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15", to: "2028-11-14" }] },
  verdict_signals: [
    {
      area: "marriage",
      trend: "MIXED",
      positive: ["benefic Jupiter house 7 mein"],
      negative: ["Mars ki drishti house 7 par"],
    },
  ],
};
const supported =
  "Jupiter 7ve ghar mein hai.\n\nMars antardasha 15 Sept 2027 se 14 Nov 2028 mein shaadi sambhavit hai.";

void test("timing intent stays consistent across topics and shorthand without adding unsolicited dates", () => {
  for (const query of [
    "shaadi kb hogi",
    "Meri job kab lagegi",
    "How soon will my career improve?",
    "Meri shaadi kis saal hogi",
    "Paise kitni der mein theek honge",
    "Will I marry by 2028?",
    "Shaadi 2028 tak hogi?",
    "मेरी शादी कब होगी?",
  ]) {
    assert.equal(asksForTiming(query), true, query);
  }
  for (const query of [
    "Mere career fields batao",
    "My birth year is 2001",
    "Explain the seventh house",
    "What is a dasha?",
  ]) {
    assert.equal(asksForTiming(query), false, query);
  }
  const evidence = JSON.stringify({
    ...row,
    verdict_signals: [{ area: "marriage", trend: "MIXED", positive: [], negative: [] }],
  });
  for (const query of ["shaadi kab hogi", "shaadi kb hogi", "shaadi kis saal hogi"]) {
    const answer = evidenceFallback(
      [evidence],
      "hinglish",
      query,
      new Date("2026-10-26T00:00:00Z"),
    );
    assert.match(answer, /2027-09-15.*2028-11-14/);
    assert.doesNotMatch(answer, /Relationship ki reading mein mixed/);
  }
});

void test("observed start-only correction remains rejected and receives exact repair targets", () => {
  const draft =
    "Jupiter 7ve ghar mein hai, shaadi mein delay hai.\n\n2027-09-15 se Mars antardasha shuru hoga, tab 7ve ghar ka yog balwaan hoga.";
  assert.equal(unsupportedEventTiming(draft, [JSON.stringify(row)]), true);
  const instruction = timingRepairEvidence([JSON.stringify(row)]);
  assert.match(instruction, /September 2027/);
  assert.match(instruction, /November 2028/);
  assert.match(instruction, /BOTH month-year boundaries/);
  assert.match(instruction, /period change alone does not establish improvement/);
  assert.equal(timingRepairEvidence(["bad JSON"]), "");
  assert.equal(
    timingRepairEvidence([JSON.stringify(row), JSON.stringify({ ...row, dasha: {} })]),
    "",
  );
  const invalid = structuredClone(row);
  invalid.dasha.upcoming_antardashas[0].from = "2027-02-30";
  assert.equal(timingRepairEvidence([JSON.stringify(invalid)]), "");
});

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

for (const toolRounds of [4, 6]) {
  void test(`source timing correction respects the seven-round cap after ${toolRounds} tool rounds`, async () => {
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
        fetchImpl: async (_url, options) => {
          calls++;
          const tool = calls <= toolRounds;
          const body = JSON.parse(options.body);
          const correction = calls === toolRounds + 2;
          if (correction) {
            assert.equal(body.tool_choice, "auto");
            assert.match(
              body.messages.at(-1).content,
              /Preserve the useful supported topic explanation/,
            );
          }
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
                    : correction
                      ? {
                          content:
                            "Jupiter 7ve ghar mein hai aur Mars ki drishti se rukawat hai.\n\nMars antardasha September 2027 se November 2028 mein shaadi sambhavit hai.",
                        }
                      : { content: "Shaadi 2029 mein hogi." },
                },
              ],
            }),
          );
        },
      },
    );
    assert.equal(calls, Math.min(toolRounds + 2, 7));
    if (toolRounds === 4) {
      assert.match(result.reply, /September 2027 se November 2028/);
      assert.doesNotMatch(result.reply, /Shaadi ka samay:|Rishte ko lekar/);
    } else {
      assert.match(result.reply, /Mangal ki antardasha 15 September 2027 se 14 November 2028 tak chalegi/);
    }
    assert.doesNotMatch(result.reply, /2029|sub-period runs|schedule/);
  });
}

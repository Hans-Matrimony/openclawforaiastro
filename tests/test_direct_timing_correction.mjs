import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
import { houseLordConflicts } from "../extensions/reviewed-reading/direct/house-evidence.mjs";
import { readingFallback } from "../extensions/reviewed-reading/direct/reading-fallback.mjs";
import { timingCorrection } from "../extensions/reviewed-reading/direct/timing-correction.mjs";

const now = () => new Date("2026-10-26T00:00:00Z");
const row = {
  engine: "local-sweph-v2",
  evidence_scope: { timing: "does not calculate event-specific windows" },
  dasha: {
    upcoming_antardashas: [
      { lord: "Mars", from: "2027-09-15", to: "2028-11-14" },
      { lord: "Jupiter", from: "2031-11-15", to: "2034-07-16" },
    ],
  },
  verdict_signals: [
    {
      area: "marriage",
      trend: "MIXED",
      positive: ["benefic Jupiter house 7 mein"],
      negative: ["Mars ki drishti house 7 par"],
    },
  ],
};
const evidence = [JSON.stringify(row)];
const value = {
  period_id: "p1",
  outlook: "possible",
  factor_ids: ["f0"],
};
const message = (data) => ({
  tool_calls: [
    {
      id: "repair",
      type: "function",
      function: { name: "submit_timing_reading", arguments: JSON.stringify(data) },
    },
  ],
});

void test("structured timing uses the selected period, never automatically the next one", () => {
  const correction = timingCorrection(evidence, "shaadi kb hogi", "hinglish", now());
  const reply = correction.render(message(value));
  assert.equal(
    reply.split("\n\n")[1],
    "Jupiter ki antardasha mein November 2031 se July 2034 ke beech shaadi hone ki sambhavna hai.",
  );
  assert.doesNotMatch(reply, /2027|2028/);
  assert.equal(unsupportedEventTiming(reply, evidence), false);
  assert.equal(reply.split("\n\n").length, 2);
});

void test("all three outlooks preserve their meaning and no support forces no date", () => {
  const correction = timingCorrection(evidence, "shaadi kb hogi", "hinglish", now());
  for (const [outlook, expected] of [
    ["possible", /sambhavna hai/],
    ["unfavorable", /sambhavna kam hai/],
    ["mixed", /rukawatein bhi hain/],
  ]) {
    assert.match(correction.render(message({ ...value, outlook })), expected);
  }
  const none = correction.render(
    message({
      ...value,
      period_id: "none",
      outlook: "undetermined",
    }),
  );
  assert.doesNotMatch(none, /20\d{2}|Mars|Jupiter/);
  assert.match(none, /deri/);
});

void test("malformed submissions, fabricated dates and unsupported period selections fail closed", () => {
  const correction = timingCorrection(evidence, "shaadi kb hogi", "hinglish", now());
  for (const bad of [
    { ...value, period_id: "p99" },
    { ...value, outlook: "certain" },
    { ...value, factor_ids: ["f1"] },
    { ...value, factor_ids: ["f0", "f0"] },
    { ...value, factor_ids: ["f99"] },
    { ...value, explanation: "February 2028 mein shaadi hogi." },
    { ...value, reason: "Dasha badal rahi hai." },
    { ...value, extra: "untrusted" },
    { ...value, reason: "Mars ka 7ve ghar se sambandh hai." },
    { ...value, period_id: "none" },
    { ...value, undated_verdict: "Tomorrow" },
  ]) {
    assert.equal(correction.render(message(bad)), null, JSON.stringify(bad));
  }
  assert.equal(correction.render({ content: "2028 mein hogi" }), null);
  assert.equal(
    correction.render({ tool_calls: [...message(value).tool_calls, ...message(value).tool_calls] }),
    null,
  );
  assert.equal(timingCorrection(["bad"], "shaadi kb hogi", "hinglish", now()), null);
  assert.equal(
    timingCorrection(
      [...evidence, JSON.stringify({ ...row, dasha: {} })],
      "shaadi kb hogi",
      "hinglish",
      now(),
    ),
    null,
  );
  assert.equal(
    timingCorrection(evidence, "shaadi kb hogi", "hinglish", new Date("2040-01-01")),
    null,
  );
});

void test("timing failure preserves an undated explanation but not contradictory chart claims", () => {
  const draft = "Shaadi mein rukawat aur sahyog dono hain.\n\n2027 mein shaadi pakki hai.";
  const reply = readingFallback(draft, evidence, "hinglish", "shaadi kb hogi", now());
  assert.ok(reply.startsWith("Shaadi mein rukawat aur sahyog dono hain."));
  assert.doesNotMatch(reply, /pakki/);
  const contradicted = [
    JSON.stringify({ ...row, birth_chart: { planets: ["Jupiter: Taurus | house 7"] } }),
  ];
  assert.doesNotMatch(
    readingFallback(
      "Jupiter in house 10 hai aur shaadi ka sahyog hai.\n\n2028 mein hogi.",
      contradicted,
      "hinglish",
      "shaadi kb hogi",
      now(),
    ),
    /house 10/,
  );
});

void test("captured wrong house-lord rationale is rejected in both Hinglish word orders", () => {
  const chart = JSON.stringify({
    ...row,
    birth_chart: {
      ashtakavarga_house_bindus: { house_7: { sign: "Taurus" }, house_12: { sign: "Libra" } },
    },
  });
  for (const text of [
    "7ve ghar ka lord Mars hai.",
    "Mars 12ve ghar mein hai, jo 7ve ghar ka lord hai.",
    "Mars 12ve ghar mein hai jahan se 7ve ghar ka lord banta hai.",
  ]) {
    assert.deepEqual(houseLordConflicts(text, [chart]), [
      { house: 7, expected: "Venus", claimed: "Mars" },
    ]);
  }
  for (const text of [
    "7ve ghar ka lord Venus hai.",
    "7ve ghar ka lord Mars nahi hai.",
    "Mars 7ve ghar ka lord nahi hai.",
    "Mars antardasha mein 7ve ghar ka lord Venus hai.",
  ]) {
    assert.deepEqual(houseLordConflicts(text, [chart]), []);
  }
  const correction = timingCorrection([chart], "shaadi kb hogi", "hinglish", now());
  assert.match(correction.instruction, /"house":7,"lord":"Venus"/);
  for (const text of [
    "Mars aur Rahu ke baad Jupiter dasha mein aayega, kyunki Jupiter house 7 ka lord hai.",
    "Jupiter ka lordship house 7 par hai.",
  ]) {
    assert.deepEqual(houseLordConflicts(text, [chart]), [
      { house: 7, expected: "Venus", claimed: "Jupiter" },
    ]);
  }
  assert.doesNotMatch(
    readingFallback(
      "Mars antardasha shuru hone se pehle koi strong timing nahi hai.\n\n2027 mein shaadi hogi.",
      [chart],
      "hinglish",
      "shaadi kb hogi",
      now(),
    ),
    /pehle koi strong/,
  );
});

void test("repair retains current transit evidence and excludes already-started upcoming entries", () => {
  const transits = JSON.stringify({
    engine: "local-sweph-v2",
    gochara: [{ planet: "Saturn", over_natal_house: 5 }],
  });
  const correction = timingCorrection([transits, ...evidence], "shaadi kb hogi", "hinglish", now());
  assert.equal(correction.evidence.length, 2);
  assert.deepEqual(correction.evidence[0].gochara, JSON.parse(transits).gochara);
  const later = timingCorrection(evidence, "shaadi kb hogi", "hinglish", new Date("2028-01-01"));
  assert.doesNotMatch(later.instruction, /September 2027/);
  assert.match(later.instruction, /November 2031/);
});

void test("agent repairs the captured start-only failure without redoing calculations or memory writes", async () => {
  let calls = 0,
    tools = 0;
  const result = await directAnswer(
    {
      user_id: "synthetic-timing-repair",
      query: "shaadi kb hogi",
      language: "hinglish",
      history: [],
      birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
    },
    {
      now,
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_FLOW: "source",
        VEDASTRO_DIRECT_ENVIRONMENT: "development",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
      },
      makeMemory: () => ({ read: async () => [], write: () => assert.fail("No memory writes") }),
      makeTools: () => async () => {
        tools++;
        return evidence[0];
      },
      fetchImpl: async (_url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        let reply;
        if (calls === 1) {
          reply = {
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
          };
        } else if (calls === 2) {
          reply = {
            content:
              "Shaadi mein delay hai.\n\n2027-09-15 se Mars antardasha shuru hoga, tab 7ve ghar ka yog balwaan hoga.",
          };
        } else if (calls === 3) {
          assert.equal(body.tool_choice.function.name, "submit_timing_reading");
          assert.equal(body.tools.length, 1);
          assert.equal(body.messages.length, 2);
          assert.doesNotMatch(JSON.stringify(body.messages), /tab 7ve ghar ka yog balwaan/);
          reply = message(value);
        } else {
          assert.equal(calls, 4);
          assert.equal(body.tools, undefined);
          reply = { content: "Shaadi ko lekar abhi ghar mein kya baat chal rahi hai?" };
        }
        return new Response(
          JSON.stringify({
            choices: [{ finish_reason: reply.tool_calls ? "tool_calls" : "stop", message: reply }],
          }),
        );
      },
    },
  );
  assert.equal(tools, 1);
  assert.equal(calls, 4);
  assert.match(result.reply, /November 2031 se July 2034/);
  assert.doesNotMatch(result.reply, /2027|2028|antardasha .*tak hai/);
  assert.ok(result.answer_validation.includes("timing_structure_received"));
  assert.ok(!result.answer_validation.includes("timing_fallback"));
  assert.equal(result.reply.split(/\n\s*\n/).length, 3);
});

for (const invalid of ["malformed", "wrong_house_lord"]) {
  void test(`a ${invalid} structured correction cannot trigger another tool loop or leak its reading`, async () => {
    let calls = 0,
      executions = 0;
    const chart = JSON.stringify({
      ...row,
      birth_chart: {
        ashtakavarga_house_bindus: {
          house_7: { sign: "Taurus" },
          house_12: { sign: "Libra" },
        },
      },
    });
    const result = await directAnswer(
      {
        user_id: "synthetic-repair-invalid",
        query: "shaadi kb hogi",
        history: [],
        language: "hinglish",
        birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
      },
      {
        now,
        env: {
          OPENROUTER_API_KEY: "test",
          VEDASTRO_DIRECT_FLOW: "source",
          VEDASTRO_DIRECT_ENVIRONMENT: "development",
          VEDASTRO_DIRECT_REPLY_CACHE: "0",
          VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
        },
        makeMemory: () => ({ read: async () => [] }),
        makeTools: () => async () => {
          executions++;
          return chart;
        },
        fetchImpl: async () => {
          calls++;
          let reply;
          if (calls === 1) {
            reply = {
              tool_calls: [
                {
                  id: "read",
                  type: "function",
                  function: {
                    name: "mcp__VedAstro__get_horoscope_predictions",
                    arguments: "{}",
                  },
                },
              ],
            };
          } else if (calls === 2) {
            reply = { content: "Shaadi 2029 mein pakki hogi." };
          } else if (calls === 3) {
            reply =
              invalid === "malformed"
                ? message({})
                : message({
                    ...value,
                    period_id: "p0",
                    explanation: "Shaadi mein rukawat bhi hai.",
                    reason: "Mars 12ve ghar mein hai, jo 7ve ghar ka lord hai.",
                  });
          } else {
            assert.equal(calls, 4);
            reply = { content: "Ghar mein shaadi ko lekar kya baat chal rahi hai?" };
          }
          return new Response(
            JSON.stringify({
              choices: [
                { finish_reason: reply.tool_calls ? "tool_calls" : "stop", message: reply },
              ],
            }),
          );
        },
      },
    );
    assert.equal(calls, 4);
    assert.equal(executions, 1);
    assert.doesNotMatch(result.reply, /2029|pakki|jo 7ve ghar ka lord/);
    assert.ok(result.answer_validation.includes("timing_fallback"));
  });
}

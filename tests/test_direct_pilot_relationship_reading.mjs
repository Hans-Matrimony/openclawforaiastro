import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import {
  isBarePeriodSchedule,
  isFailedReadingResult,
  relationshipVerdictIssue,
} from "../extensions/reviewed-reading/direct/pilot-relationship-reading.mjs";
import { timingCorrection } from "../extensions/reviewed-reading/direct/timing-correction.mjs";
import { resolveReadingTopic } from "../extensions/reviewed-reading/direct/topic-period-context.mjs";
import {
  now,
  query,
  chart,
  results,
  schedule,
  input,
  env,
  prose,
  tool,
} from "./fixtures/relationship-pilot.mjs";

test("the existing relationship topic covers the reported crush question without new keyword rules", () => {
  assert.equal(resolveReadingTopic(query).topic, "relationship");
  assert.equal(resolveReadingTopic("Meri crush aur mera career kab settle hoga?"), null);
});
test("default crush fallback stays identical while the opt-in renderer retains assessment and dates", () => {
  assert.equal(evidenceFallback(results, "hinglish", query, now()), schedule);
  const result = evidenceFallback(results, "hinglish", query, now(), { topic: "relationship" });
  assert.match(result, /sahyog bhi hai aur rukawatein bhi/);
  assert.match(result, /Shani/);
  assert.match(result, /2027-03-07.*2030-01-11/);
  assert.notEqual(result, schedule);
  assert.equal(isBarePeriodSchedule(schedule, results, "hinglish", now()), true);
  assert.equal(isBarePeriodSchedule(result, results, "hinglish", now()), false);
});
test("relationship repair retains unfavorable period outlook and opposing factors", () => {
  const correction = timingCorrection(results, query, "hinglish", now(), { topic: "relationship" });
  assert.ok(correction);
  const reply = correction.render({
    tool_calls: [
      {
        function: {
          name: correction.name,
          arguments: JSON.stringify({
            period_id: "p0",
            outlook: "unfavorable",
            factor_ids: ["f1"],
          }),
        },
      },
    ],
  });
  assert.match(reply, /sambhavna kam hai/);
  assert.match(reply, /Shukra/);
  assert.match(reply, /Shani/);
  assert.match(reply, /March 2027.*January 2030/);
  assert.doesNotMatch(reply, /pakka|zaroor/);
});
test("conflicting subjects or missing outlook cannot be converted to a positive answer", () => {
  const changed = structuredClone(chart);
  changed.birth_chart.planets = ["Sun: Leo | house 10"];
  const answer = evidenceFallback([...results, JSON.stringify(changed)], "hinglish", query, now(), {
    topic: "relationship",
  });
  assert.doesNotMatch(answer, /sahyog dikh raha|sambhavna hai|2027-03-07/);
  const missing = { ...chart, verdict_signals: [] };
  assert.doesNotMatch(
    evidenceFallback([JSON.stringify(missing)], "hinglish", query, now(), {
      topic: "relationship",
    }),
    /sambhavna hai|2027-03-07/,
  );
});

async function run(overrides = {}, value = input) {
  let readings = 0,
    routes = 0;
  const result = await directAnswer(value, {
    env: { ...env, ...overrides },
    now,
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => JSON.stringify(chart),
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      if (body.response_format) {
        routes++;
        return prose(JSON.stringify({ route: "checked_reading", reply: "" }));
      }
      if (!body.tools) {
        return prose("NONE");
      }
      readings++;
      if (readings === 1) {
        return tool();
      }
      return prose(schedule);
    },
  });
  return { result, readings, routes };
}
test("pilot repeated schedule-only drafts retain an assessment through the actual delivery path", async () => {
  const { result, readings } = await run();
  assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
  assert.match(result.reply, /2027-03-07.*2030-01-11/);
  assert.ok(readings >= 3);
  assert.ok(result.answer_validation.includes("reading_wording_rejected"));
  assert.ok(result.answer_reading_tools.includes("get_horoscope_predictions"));
});
test("nonpilot and switch-off retain their old schedule output", async () => {
  for (const config of [
    { ASTROFRIEND_CONVERSATION_PROGRESS_USERS: "919000000002" },
    { ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED: "0" },
  ]) {
    const { result, readings } = await run(config);
    assert.equal(result.reply, schedule + "\n\nKya aapne unse apni feelings share ki hain?");
    assert.equal(readings, 2);
  }
});
test("semantic yes/no follow-up uses checked reading and the latest relationship subject", async () => {
  const value = {
    ...input,
    query: "Seedha batao haan ya naa?",
    history: [
      { role: "user", text: query },
      { role: "assistant", text: schedule },
    ],
  };
  const { result, routes } = await run({}, value);
  assert.equal(routes, 1);
  assert.ok(result.answer_reading_tools.includes("get_horoscope_predictions"));
  assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
});

test("serialized tool failures cannot establish reading evidence in the pilot", async () => {
  for (const failed of [
    { isError: true, message: "Unavailable" },
    JSON.stringify({ isError: true, message: "Unavailable" }),
  ]) {
    assert.equal(isFailedReadingResult(failed), true);
    let calls = 0;
    const value = {
      ...input,
      query: "Seedha batao haan ya naa?",
      history: [
        { role: "user", text: query },
        { role: "assistant", text: schedule },
      ],
    };
    const result = await directAnswer(value, {
      env,
      now,
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async (name) =>
        name.endsWith("get_horary_prediction") ? failed : JSON.stringify(chart),
      fetchImpl: async (_, options) => {
        const body = JSON.parse(options.body);
        if (body.response_format) {
          return prose(JSON.stringify({ route: "checked_reading", reply: "" }));
        }
        if (!body.tools) {
          return prose("NONE");
        }
        calls++;
        if (calls === 1) {
          const response = await tool().json();
          response.choices[0].message.tool_calls[0].function.name =
            "mcp__VedAstro__get_horary_prediction";
          return Response.json(response);
        }
        if (calls === 2) {
          assert.match(body.messages.at(-1).content, /Tool failed:/);
          return tool();
        }
        return prose(schedule);
      },
    });
    assert.deepEqual(result.answer_reading_tools, ["get_horoscope_predictions"]);
    assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
  }
  assert.equal(isFailedReadingResult('{"isError":false,"data":1}'), false);
  assert.equal(isFailedReadingResult("ordinary tool prose"), false);
});

test("resolved relationship timing is checked without altering default topic handling", () => {
  const data = [
    JSON.stringify({
      ...chart,
      evidence_scope: { timing: "does not calculate event-specific windows" },
    }),
  ];
  const raw =
    "Baat shuru hone ka signal 2027-03-07 se 2030-01-11 tak Saturn antardasha mein hi possible hai.";
  assert.equal(unsupportedEventTiming(raw, data, query), false);
  assert.equal(unsupportedEventTiming(raw, data, query, { topic: "relationship" }), true);
  const natural =
    "Saturn ki house 7 par drishti se rukawat hai. March 2027 se January 2030 tak Saturn antardasha mein rishte ka aage badhna sambhavit hai, lekin rukawatein bhi hain.";
  assert.equal(unsupportedEventTiming(natural, data, query, { topic: "relationship" }), false);
  assert.equal(unsupportedEventTiming(schedule, data, query, { topic: "relationship" }), false);
  assert.equal(
    unsupportedEventTiming(natural.replace("sambhavit hai", "mein hi possible hai"), data, query, {
      topic: "relationship",
    }),
    true,
  );
});

test("missing or invalid relationship outlook cannot become a schedule-only yes/no", () => {
  for (const signal of [
    [],
    [
      {
        area: "marriage",
        positive: ["benefic Venus house 7 mein"],
        negative: [],
        trend: "unknown",
      },
    ],
  ]) {
    const data = [JSON.stringify({ ...chart, verdict_signals: signal })];
    assert.equal(timingCorrection(data, query, "hinglish", now(), { topic: "relationship" }), null);
    assert.doesNotMatch(
      evidenceFallback(data, "hinglish", "Seedha batao haan ya naa?", now(), {
        topic: "relationship",
      }),
      /sambhavna hai|2027-03-07/,
    );
  }
});

test("mixed natal indications cannot be published as a standalone no or yes", async () => {
  for (const raw of ["null", "[]", '"not chart evidence"', "{broken"]) {
    assert.equal(relationshipVerdictIssue("Nahi.", [raw]), null);
  }
  for (const verdict of ["Nahi.", "Haan.", "No.", "Yes.", "Naa, abhi nahi.", "Haan, baat hogi."]) {
    assert.ok(relationshipVerdictIssue("7ve ghar mein rukawatein hain.\n\n" + verdict, results));
  }
  assert.equal(
    relationshipVerdictIssue("Rishte mein sahyog bhi hai aur rukawatein bhi.", results),
    null,
  );
  assert.equal(
    relationshipVerdictIssue(
      "Haan, baat aage badhne ki sambhavna hai, lekin rukawatein bhi hain.",
      results,
    ),
    null,
  );
  assert.equal(
    relationshipVerdictIssue("Nahi.", [
      ...results,
      JSON.stringify({ horary_number: 12, verdict: "NO" }),
    ]),
    null,
  );
  assert.equal(
    relationshipVerdictIssue("Nahi.", [
      JSON.stringify({ ...chart, verdict_signals: [{ area: "marriage", trend: "NEGATIVE" }] }),
    ]),
    null,
  );
  assert.ok(
    relationshipVerdictIssue(
      "Saturn bhi yahan baitha hai, isliye abhi baat shuru hone ka yog nahi bana. NAHI, abhi nahi.",
      results,
    ),
  );
  const value = {
    ...input,
    query: "Seedha batao haan ya naa?",
    history: [
      { role: "user", text: query },
      { role: "assistant", text: schedule },
    ],
  };
  let calls = 0;
  const result = await directAnswer(value, {
    env,
    now,
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => JSON.stringify(chart),
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      if (body.response_format) {
        return prose(JSON.stringify({ route: "checked_reading", reply: "" }));
      }
      if (!body.tools) {
        return prose("NONE");
      }
      return ++calls === 1 ? tool() : prose("7ve ghar mein rukawatein hain.\n\nNahi.");
    },
  });
  assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
  assert.doesNotMatch(result.reply, /(?:^|\n)Nahi\.|Relationship ki reading|2027-03-07/);
  assert.ok(result.answer_validation.includes("reading_wording_rejected"));
});

test("relationship pilot does not skip a newer topic or change other reply surfaces", async () => {
  const value = {
    ...input,
    query: "Seedha batao haan ya naa?",
    history: [
      { role: "user", text: query },
      { role: "assistant", text: schedule },
      { role: "user", text: "Mera career kab set hoga?" },
    ],
  };
  let readings = 0;
  await directAnswer(value, {
    env,
    now,
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => JSON.stringify(chart),
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      if (body.response_format) {
        return prose(JSON.stringify({ route: "checked_reading", reply: "" }));
      }
      assert.ok(!JSON.stringify(body.messages).includes("Relationship answer completeness"));
      if (!body.tools) {
        return prose("NONE");
      }
      return ++readings === 1 ? tool() : prose(schedule);
    },
  });
  for (const reply_surface of ["pwa", "voice"]) {
    const enabled = await run({}, { ...input, reply_surface });
    const disabled = await run(
      { ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED: "0" },
      { ...input, reply_surface },
    );
    assert.deepEqual(enabled.result, disabled.result);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import { periodFallback } from "../extensions/reviewed-reading/direct/period-fallback.mjs";
import {
  readingAssessment,
  readingVerdictIssue,
  readingTopicArea,
  readingUnavailableIssue,
  categoricalOutcomeClaim,
} from "../extensions/reviewed-reading/direct/pilot-relationship-reading.mjs";
import { now, input, env, prose, tool } from "./fixtures/relationship-pilot.mjs";

const chart = {
  engine: "local-sweph-v2",
  birth_chart: {
    planets: [
      "Jupiter: Libra | house 7",
      "Saturn: Aries | house 1",
      "Sun: Capricorn | house 10",
      "Mercury: Taurus | house 2",
      "Ketu: Taurus | house 2",
    ],
  },
  dasha: {
    upcoming_antardashas: [
      { lord: "Jupiter", from: "2027-05-01", to: "2028-07-01" },
      { lord: "Sun", from: "2028-07-01", to: "2029-05-01" },
      { lord: "Mercury", from: "2029-05-01", to: "2030-10-01" },
    ],
  },
  verdict_signals: [
    {
      area: "marriage",
      trend: "MIXED",
      positive: ["benefic Jupiter house 7 mein"],
      negative: ["Saturn ki drishti house 7 par"],
    },
    {
      area: "career",
      trend: "MIXED",
      positive: ["benefic Sun house 10 mein"],
      negative: ["Saturn retrograde results me Atkaav"],
    },
    {
      area: "money",
      trend: "MIXED",
      positive: ["benefic Mercury house 2 mein"],
      negative: ["malefic Ketu house 2 mein"],
    },
  ],
};
const rows = [JSON.stringify(chart)];
const schedule = periodFallback([chart], "hinglish", now());
const topics = [
  {
    topic: "marriage",
    when: "Meri shaadi kab hogi?",
    whether: "Kya meri shaadi hogi?",
    factor: /Guru/,
    window: /May 2027.*July 2028/,
  },
  {
    topic: "career",
    when: "Mera career kab set hoga?",
    whether: "Kya mujhe job milegi?",
    factor: /Surya/,
    window: /July 2028.*May 2029/,
  },
  {
    topic: "money",
    when: "Meri financial growth kab hogi?",
    whether: "Kya meri financial growth hogi?",
    factor: /Budh/,
    window: /May 2029.*October 2030/,
  },
];

async function run(
  query,
  {
    history = [],
    draft = schedule,
    config = {},
    surface = "whatsapp",
    data = chart,
    execute,
    supplement = false,
    closing = "NONE",
  } = {},
) {
  let readings = 0,
    calculations = 0;
  const requests = [];
  const result = await directAnswer(
    { ...input, query, history, reply_surface: surface },
    {
      env: { ...env, ...config },
      now,
      makeMemory: () => ({
        read: async () => [],
        write: async () => assert.fail("No memory write"),
      }),
      makeTools: () => async (name) => {
        calculations++;
        return execute ? execute(name) : JSON.stringify(data);
      },
      fetchImpl: async (_, options) => {
        const body = JSON.parse(options.body);
        requests.push(body);
        if (body.response_format) {
          return prose(JSON.stringify({ route: "checked_reading", reply: "" }));
        }
        if (!body.tools) {
          return prose(closing);
        }
        if (++readings === 1) {
          if (!supplement) {
            return tool();
          }
          const response = await tool().json();
          response.choices[0].message.tool_calls.push({
            id: "transits",
            type: "function",
            function: { name: "mcp__VedAstro__get_current_transits", arguments: "{}" },
          });
          return Response.json(response);
        }
        return prose(draft);
      },
    },
  );
  return { result, requests, calculations };
}

for (const item of topics) {
  test(`${item.topic}: date-only timing draft is repaired with the correct assessment and supported period`, async () => {
    const { result, calculations } = await run(item.when);
    assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
    assert.match(result.reply, item.factor);
    assert.match(result.reply, item.window);
    assert.notEqual(result.reply, schedule);
    assert.equal(calculations, 1);
    assert.ok(result.answer_model_calls <= 8);
  });
  for (const draft of ["Haan.", "Nahi."]) {
    test(`${item.topic}: mixed evidence cannot publish ${draft}`, async () => {
      const { result } = await run(item.whether, { draft });
      assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
      assert.match(result.reply, item.factor);
      assert.doesNotMatch(result.reply, /\b20\d{2}\b/);
      assert.notEqual(result.reply, draft);
    });
  }
  test(`${item.topic}: short follow-up retains the immediately preceding topic`, async () => {
    const { result } = await run("Seedha batao haan ya naa?", {
      draft: "Nahi.",
      history: [
        { role: "user", text: item.when },
        { role: "assistant", text: schedule },
      ],
    });
    assert.ok(result.reply.includes(readingAssessment("MIXED", "hinglish", item.topic)));
    assert.match(result.reply, item.factor);
    assert.doesNotMatch(result.reply, /\b20\d{2}\b/);
  });
  for (const trend of ["POSITIVE", "NEGATIVE"]) {
    test(`${item.topic}: ${trend} stays qualified without reversing its meaning`, async () => {
      const data = structuredClone(chart),
        signal = data.verdict_signals.find((s) => s.area === item.topic);
      signal.trend = trend;
      if (trend === "POSITIVE") {
        signal.negative = [];
      } else {
        signal.positive = [];
      }
      const { result } = await run(item.whether, {
        data,
        draft: trend === "POSITIVE" ? "Haan." : "Nahi.",
      });
      assert.ok(result.reply.includes(readingAssessment(trend, "hinglish", item.topic)));
      assert.doesNotMatch(
        result.reply,
        trend === "POSITIVE" ? /rukawaton ke sanket zyada/ : /sahyog ke sanket hain/,
      );
    });
  }
  test(`${item.topic}: missing topic evidence is not converted into a negative forecast`, async () => {
    const data = {
      ...chart,
      verdict_signals: chart.verdict_signals.filter((s) => s.area !== item.topic),
    };
    const { result } = await run(item.whether, { data, draft: "Nahi." });
    assert.match(result.reply, /verify/);
    assert.doesNotMatch(result.reply, /^Nahi\.|rukawaton ke sanket zyada|20\d{2}/);
  });
  test(`${item.topic}: nonpilot, disabled switch and other surfaces retain legacy output`, async () => {
    for (const options of [
      { config: { ASTROFRIEND_CONVERSATION_PROGRESS_USERS: "919000000002" } },
      { config: { ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED: "0" } },
      { surface: "pwa" },
      { surface: "voice" },
    ]) {
      const enabled = await run(item.when, options);
      const disabled = await run(item.when, {
        ...options,
        config: { ...options.config, ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED: "0" },
      });
      assert.equal(enabled.result.reply, disabled.result.reply);
      assert.ok(
        !enabled.requests.some((body) =>
          JSON.stringify(body.messages).includes(`Answer completeness for ${item.topic}`),
        ),
      );
    }
  });
}

test("a clear qualified answer is preserved without rewriting or repeated calculation", async () => {
  const draft =
    "Career mein sahyog bhi hai aur rukawatein bhi. Surya ka 10ve ghar mein hona sahyog ka sanket hai.\n\nHaan, aage badhne ki sambhavna hai, lekin rukawatein bhi hain.";
  const { result, calculations } = await run("Kya mujhe job milegi?", { draft });
  assert.equal(result.reply.replace(/\s+/gu, " "), draft.replace(/\s+/gu, " "));
  assert.equal(calculations, 1);
  assert.deepEqual(result.answer_validation, []);
});

test("factual clarification and explicitly requested schedules do not gain an outcome verdict", async () => {
  for (const query of [
    "Mere career chart ka 10th house strength verify karo.",
    "List my upcoming career dasha schedule.",
  ]) {
    const { result, requests } = await run(query);
    assert.ok(
      !requests.some((body) =>
        JSON.stringify(body.messages).includes("Answer completeness for career"),
      ),
    );
    if (query.includes("schedule")) {
      assert.equal(result.reply, schedule);
    }
  }
});

test("an older marriage topic is not revived across a newer career question", async () => {
  const { result } = await run("Seedha batao haan ya naa?", {
    draft: "Nahi.",
    history: [
      { role: "user", text: topics[0].when },
      { role: "assistant", text: schedule },
      { role: "user", text: topics[1].whether },
    ],
  });
  assert.match(result.reply, /Career mein/);
  assert.doesNotMatch(result.reply, /Shaadi/);
});

test("matching and foreign questions retain their distinct reading contracts", async () => {
  for (const query of [
    "Meri marriage matching ka guna score kya hai?",
    "Mere abroad career ke chances kya hain?",
  ]) {
    const { requests } = await run(query);
    assert.ok(
      !requests.some((body) => JSON.stringify(body.messages).includes("Answer completeness for")),
    );
  }
});

test("successful horary/event verdicts are not rejected by natal outcome guards", () => {
  for (const topic of ["marriage", "career", "money", "relationship"]) {
    assert.equal(
      readingVerdictIssue(
        "Haan.",
        [...rows, JSON.stringify({ horary_number: 1, verdict: "YES" })],
        topic,
      ),
      null,
    );
    assert.equal(
      readingVerdictIssue(
        "Nahi.",
        [...rows, JSON.stringify({ event_windows: [{ from: "2027-01-01" }] })],
        topic,
      ),
      null,
    );
  }
  assert.equal(readingTopicArea("constructor"), null);
});

test("conflicting subjects and signal trends cannot establish a categorical outcome", () => {
  const other = structuredClone(chart);
  other.birth_chart.planets = ["Sun: Leo | house 5"];
  assert.ok(readingVerdictIssue("Haan.", [...rows, JSON.stringify(other)], "career"));
  assert.match(
    evidenceFallback([...rows, JSON.stringify(other)], "hinglish", topics[1].whether, now(), {
      topic: "career",
    }),
    /verify/,
  );
});

test("a failed supplementary calculation does not erase available checked career evidence", async () => {
  let calls = 0;
  const failure =
    "Kuchh bhi nahi mil raha tools fail ho rahe hain. Kripya phir se try karein ya birth details check karein.";
  const { result, requests } = await run(topics[1].whether, {
    draft: failure,
    supplement: true,
    execute: () =>
      ++calls === 1
        ? JSON.stringify(chart)
        : JSON.stringify({ isError: true, message: "Supplement unavailable" }),
  });
  // The checked chart alone also rules out this claim; no invented horary verdict.
  assert.match(result.reply, /Career mein sahyog bhi hai aur rukawatein bhi/);
  assert.doesNotMatch(result.reply, /tools fail|birth details check|20\d{2}/);
  assert.ok(result.answer_validation.includes("reading_wording_fallback"));
  assert.equal(calls, 2);
  assert.deepEqual(result.answer_reading_tools, ["get_horoscope_predictions"]);
  assert.ok(
    requests.some((body) =>
      JSON.stringify(body.messages).includes(
        "successful natal chart results above remain available",
      ),
    ),
  );
  assert.ok(
    requests.some((body) => JSON.stringify(body.messages).includes("failed supplementary tool")),
  );
});

test("honest tool limits and absent or conflicting evidence are not blanket failure claims", () => {
  for (const reply of [
    "The horary tool failed. Career indications are mixed.",
    "The chart shows mixed career indications, but current transits are unavailable.",
  ]) {
    assert.equal(readingUnavailableIssue(reply, rows, "career"), null);
  }
  assert.equal(readingUnavailableIssue("All tools failed.", [], "career"), null);
  assert.equal(
    readingUnavailableIssue("All tools failed.", [JSON.stringify({ isError: true })], "career"),
    null,
  );
  assert.equal(readingUnavailableIssue("All tools failed.", rows, "health"), null);
  const other = structuredClone(chart);
  other.verdict_signals.find((s) => s.area === "career").trend = "NEGATIVE";
  assert.equal(
    readingUnavailableIssue("All tools failed.", [...rows, JSON.stringify(other)], "career"),
    null,
  );
});

test("embedded event verdicts cannot hide behind a later qualified claim", async () => {
  for (const draft of [
    "House 10 strong hai, par dasha support weak hai. Abhi job ka yog nahi bana.",
    "Career mein sahyog aur delay hai. Abhi job nahi milegi, par baad mein mil sakti hai.",
    "You will not get a job, but later opportunities may be possible.",
    "Shaadi nahi hogi. Baad mein sambhavna ho sakti hai.",
    "Paise milenge. Lekin rukawatein ho sakti hain.",
  ]) {
    assert.equal(categoricalOutcomeClaim(draft), true, draft);
    assert.ok(readingVerdictIssue(draft, rows, "career"));
  }
  for (const draft of [
    "Abhi job ka yog nahi bana.",
    "Abhi job ka clear signal nahi, agle 6 to 8 mahine tak Moon antardasha ke end tak wait karna hoga.",
    "Abhi job nahi milegi, kyunki rukawatein hain.",
    "Abhi job nahi milegi, par 2027 se 2028 ke beech Mars antardasha mein mil sakti hai.",
  ]) {
    const { result } = await run(topics[1].whether, { draft });
    assert.match(result.reply, /Career mein sahyog bhi hai aur rukawatein bhi/);
    assert.doesNotMatch(result.reply, /Abhi job|20\d{2}/);
  }
});

test("qualified assessments, period facts and genuine user-action questions are retained", () => {
  for (const reply of [
    "Job mil sakti hai, lekin atkaav ke sanket bhi hain.",
    "Career indications are mixed, with support and obstacles.",
    "Your career dasha will start in 2027.",
    "What kind of job will you apply for?",
    "Kya aapne koi naye roles ke liye apply kiya hai?",
    "Aapne bataya tha ki job mil gayi.",
    "Tab tak wait karna zaroori nahi hai.",
    "You do not have to wait.",
  ]) {
    assert.equal(categoricalOutcomeClaim(reply), false, reply);
  }
});

test("a checked-reading companion cannot add a promise before its question", async () => {
  const draft =
    "Career mein sahyog bhi hai aur rukawatein bhi.\n\nSurya ka 10ve ghar mein hona sahyog ka sanket hai.";
  for (const closing of [
    "Haan, job milegi — aapki mehnat abhi tak kaam kar rahi hai. Kya aapne koi naya application bheja hai?",
    "Paise thoda aur time lekar behter honge. Kya aapne koi naya income source try kiya hai?",
    "Job ka intezaam abhi bhi chal raha hai, lekin ek naye mauke ka signal mil raha hai. Kya aapne koi naya application submit kiya hai?",
  ]) {
    const { result } = await run(topics[1].whether, { draft, closing });
    assert.equal(result.reply, draft);
  }
  const { result } = await run(topics[1].whether, {
    draft,
    closing: "Kis tarah ka kaam karna pasand karenge?",
  });
  assert.match(result.reply, /Kis tarah ka kaam karna pasand karenge\?/);
});

test('general natal periods cannot date a specific partner return even with qualified wording', () => {
  const query = 'Meri girlfriend kab wapas aayegi?';
  for (const draft of [
    '2031-11-15 ke baad Jupiter antardasha mein wapas aane ki sambhavna hai.',
    'Your girlfriend may return after November 2031.',
  ]) assert.match(readingVerdictIssue(draft, rows, 'relationship', { query }), /specific person/);
  assert.equal(readingVerdictIssue('Unke wapas aane ki date is chart se verify nahi hoti. General relationship indications are mixed.', rows, 'relationship', { query }), null);
  assert.equal(readingVerdictIssue('General relationship indications are mixed.', rows, 'relationship', { query }), null);
  assert.equal(readingVerdictIssue('Your girlfriend may return after November 2031.', rows, undefined, { query }), null);
});

test('mandatory wait in the captured career wording is rejected',()=>{
 assert.equal(categoricalOutcomeClaim('2027 tak wait karna padega.'),false);
 assert.equal(categoricalOutcomeClaim('2027 tak wait karna padega.', {expandedWaitCheck:true}),true);
 assert.equal(categoricalOutcomeClaim('Wait karna zaroori nahi.'),false);
});

test('captured natal placement cannot become a future transit',()=>{
 assert.match(readingVerdictIssue('Jupiter ka house 7 mein aana 2031 se shuru hoga.',rows,'marriage',{query:'Meri shaadi kab hogi?'}),/natal house placement/);
 assert.equal(readingVerdictIssue('Jupiter house 7 mein hai. Jupiter antardasha November 2031 se shuru hogi.',rows,'marriage'),null);
});
test('captured technical-first career answer must be repaired without changing the legacy path',()=>{
 const reply='Venus mahadasha aur Moon antardasha mein career ka support mixed hai.\n\nJob ka possible window 2027-09-15 ke baad.';
 assert.match(readingVerdictIssue(reply,rows,'career',{query:'Kya mujhe job milegi?'}),/first bubble/);
 assert.equal(readingVerdictIssue(reply,rows,undefined,{query:'Kya mujhe job milegi?'}),null);
});

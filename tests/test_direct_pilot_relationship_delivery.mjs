import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import {
  relationshipAssessment,
  hasOnlyNatalRelationshipEvidence,
} from "../extensions/reviewed-reading/direct/pilot-relationship-reading.mjs";
import { timingCorrection } from "../extensions/reviewed-reading/direct/timing-correction.mjs";
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

test("a rejected pilot timing draft uses one checked selector without a second free-text edit", async () => {
  let requests = 0,
    structured = 0;
  const result = await directAnswer(input, {
    env,
    now,
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => JSON.stringify(chart),
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      if (!body.tools) {
        return prose("NONE");
      }
      requests++;
      if (requests === 1) {
        return tool();
      }
      if (requests === 2) {
        return prose(Array(5).fill(schedule).join("\n\n"));
      }
      assert.equal(body.tools[0].function.name, "submit_timing_reading");
      structured++;
      return Response.json({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              tool_calls: [
                {
                  function: {
                    name: "submit_timing_reading",
                    arguments: JSON.stringify({
                      period_id: "p0",
                      outlook: "unfavorable",
                      factor_ids: ["f1"],
                    }),
                  },
                },
              ],
            },
          },
        ],
      });
    },
  });
  assert.equal(requests, 3);
  assert.equal(structured, 1);
  assert.ok(result.answer_validation.includes("relationship_wording_structured_repair"));
  assert.ok(result.answer_validation.includes("topic_timing_repaired"));
  assert.ok(!result.answer_validation.includes("reading_wording_fallback"));
  assert.match(result.reply, /sambhavna kam hai/);
  assert.match(result.reply, /Shukra/);
  assert.match(result.reply, /Shani/);
  assert.match(result.reply, /March 2027.*January 2030/);
  assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
});

test("invalid selector output stays bounded and retains assessment and calculated dates", async () => {
  let requests = 0,
    selectors = 0;
  const result = await directAnswer(input, {
    env,
    now,
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => JSON.stringify(chart),
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      if (!body.tools) {
        return prose("NONE");
      }
      if (body.tools[0].function.name === "submit_timing_reading") {
        selectors++;
        return Response.json({
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "submit_timing_reading",
                      arguments: '{"period_id":"p999","outlook":"possible","factor_ids":["f999"]}',
                    },
                  },
                ],
              },
            },
          ],
        });
      }
      return ++requests === 1 ? tool() : prose(schedule);
    },
  });
  assert.equal(selectors, 1);
  assert.ok(result.answer_model_calls <= 8);
  assert.ok(result.answer_validation.includes("topic_timing_repair_unavailable"));
  assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
  assert.match(result.reply, /2027-03-07.*2030-01-11/);
  assert.doesNotMatch(result.reply, /pakka|zaroor/);
});

test("an undetermined selector retains assessment instead of returning reasons and dates alone", () => {
  for (const language of ["hinglish", "english"]) {
    const correction = timingCorrection(results, query, language, now(), { topic: "relationship" });
    const reply = correction.render({
      tool_calls: [
        {
          function: {
            name: correction.name,
            arguments: '{"period_id":"none","outlook":"undetermined","factor_ids":["f0"]}',
          },
        },
      ],
    });
    assert.ok(reply.startsWith(relationshipAssessment("MIXED", language)));
    assert.match(reply, /2027-03-07.*2030-01-11/);
    assert.equal(reply.match(/sahyog bhi hai aur rukawatein bhi|indications are mixed/g).length, 1);
  }
  assert.equal(relationshipAssessment("unknown", "english"), "");
  assert.equal(relationshipAssessment("constructor", "english"), "");
});

test("natal wording repair never substitutes for another successful calculation type", () => {
  assert.equal(hasOnlyNatalRelationshipEvidence(results), true);
  for (const raw of [
    JSON.stringify({ horary_number: 12, verdict: "YES" }),
    JSON.stringify({ ...chart, event_windows: [{ from: "2027-01-01", to: "2027-01-10" }] }),
    JSON.stringify({ engine: "other", verdict: "YES" }),
    "Horary result: yes",
    "null",
    JSON.stringify({ ...chart, isError: true }),
  ]) {
    assert.equal(hasOnlyNatalRelationshipEvidence([...results, raw]), false);
  }
  assert.equal(hasOnlyNatalRelationshipEvidence([]), false);
});

test("a checked one-paragraph answer cannot acquire a promise from its companion", async () => {
  const base =
    "Rishte mein sahyog bhi hai aur rukawatein bhi. Guru ka 7ve ghar mein hona sahyog ka sanket hai, lekin 7ve ghar ki majbooti kam hai.";
  const value = {
    ...input,
    query: "Seedha batao haan ya naa?",
    history: [
      { role: "user", text: query },
      { role: "assistant", text: schedule },
    ],
  };
  for (const bad of [
    "Haan, lekin time tab aayega jab aapki baat dil se hogi — jaldi nahi, par pakki.",
    "Baat pakki hogi, kya aapne unse baat ki?",
    "It will definitely happen. Have you spoken to them?",
  ]) {
    assert.equal(
      await contextualClosing(base, value, { checkedReading: true, generate: async () => bad }),
      base,
    );
  }
  const safe = "Kya aapne unse apni feelings share ki hain?";
  assert.equal(
    await contextualClosing(base, value, { checkedReading: true, generate: async () => safe }),
    base + "\n\n" + safe,
  );
  assert.equal(
    await contextualClosing(base, value, {
      checkedReading: true,
      generate: async () => {
        throw Error("Unavailable");
      },
    }),
    base,
  );
});

test("semantic reading handoff requires evidence without contradictory ordinary-conversation rewrites", async () => {
  const value = {
    ...input,
    query: "Seedha batao haan ya naa?",
    history: [
      { role: "user", text: query },
      { role: "assistant", text: schedule },
    ],
  };
  let readings = 0,
    closings = 0;
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
        closings++;
        return prose(
          "Haan, lekin time tab aayega jab aapki baat dil se hogi — jaldi nahi, par pakki.",
        );
      }
      assert.ok(!JSON.stringify(body.messages).includes("# Current conversation boundary"));
      assert.ok(
        !JSON.stringify(body.messages).includes(
          "Rewrite the current answer without new tools or predictions",
        ),
      );
      readings++;
      if (readings === 1) {
        return prose("Naa, abhi nahi. 2027 ke baad tak wait karna hoga.");
      }
      if (readings === 2) {
        assert.equal(body.tool_choice, "required");
        return tool();
      }
      return prose(
        "Rishte mein sahyog bhi hai aur rukawatein bhi. Shani ki drishti se deri ka sanket hai.",
      );
    },
  });
  assert.equal(readings, 3);
  assert.equal(closings, 1);
  assert.deepEqual(result.answer_reading_tools, ["get_horoscope_predictions"]);
  assert.ok(!result.answer_validation.includes("conversation_grounding_rejected"));
  assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
  assert.doesNotMatch(result.reply, /pakki|2027 ke baad|Bina jaanch/);
});

test("the captured embedded negative verdict cannot bypass mixed-assessment validation", async () => {
  const value = {
    ...input,
    query: "Seedha batao haan ya naa?",
    history: [
      { role: "user", text: query },
      { role: "assistant", text: schedule },
    ],
  };
  const captured =
    "Venus mahadasha aur Moon antardasha (2026-01-14 se 2027-09-15) chal rahi hai, lekin house 7 ka point sirf 20 hai bahut weak.\n\nSaturn bhi yahan baitha hai, isliye abhi baat shuru hone ka yog nahi bana. NAHI, abhi nahi.";
  let readings = 0;
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
      return ++readings === 1 ? tool() : prose(captured);
    },
  });
  assert.match(result.reply, /sahyog bhi hai aur rukawatein bhi/);
  assert.doesNotMatch(result.reply, /NAHI|Saturn bhi yahan baitha|20 hai bahut weak/);
  assert.ok(result.answer_model_calls <= 12);
});

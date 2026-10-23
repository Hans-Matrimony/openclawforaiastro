import assert from "node:assert/strict";
import test from "node:test";
import { sourceReading } from "../extensions/reviewed-reading/direct/source-engine.mjs";
import { createTools } from "../extensions/reviewed-reading/direct/tools.mjs";

void test("local source engine is the default and returns tool text without network or rewriting", async () => {
  const execute = createTools({
    memory: {},
    env: {},
    reading: async (name, args, birth) => {
      assert.equal(name, "get_current_transits");
      assert.equal(args.query_text, "today");
      assert.equal(birth.location_name, "Delhi");
      return { content: [{ type: "text", text: "Exact source result." }] };
    },
    birth: { location_name: "Delhi" },
    fetchImpl: () => {
      throw new Error("Network must not run");
    },
  });
  assert.equal(
    await execute("mcp__VedAstro__get_current_transits", { query_text: "today" }),
    "Exact source result.",
  );
});

void test("source adapter handles saved ISO dates and 12-hour input without altering calculation output", async () => {
  const result = { content: [{ type: "text", text: "source output" }] };
  const loadEngine = async () => ({
    get_horoscope_predictions: (args) => {
      assert.deepEqual(args, {
        birth_date: "3/1/2001",
        birth_time: "05:00",
        location_name: "Delhi",
      });
      return result;
    },
  });
  assert.equal(
    await sourceReading(
      "get_horoscope_predictions",
      {},
      { date: "2001-01-03", time: "5:00 AM", place: "Delhi" },
      { loadEngine },
    ),
    result,
  );
});

void test("invalid dates and times fail before loading the engine", async () => {
  const loadEngine = () => {
    throw new Error("should not load");
  };
  for (const birth of [
    { date: "2001-02-30", time: "05:00" },
    { date: "2001-01-03", time: "25:00" },
  ]) {
    await assert.rejects(
      sourceReading("get_horoscope_predictions", {}, birth, { loadEngine }),
      /Invalid birth/,
    );
  }
});

void test("actual Dev calculation produces complete natal, transit, horary and matching tools", async () => {
  const birth = { date: "2001-01-03", time: "05:00", location_name: "Delhi" };
  const natal = JSON.parse(
    (await sourceReading("get_horoscope_predictions", {}, birth)).content[0].text,
  );
  assert.equal(natal.engine, "local-sweph-v2");
  assert.equal(natal.ashtakavarga.grand_total, 337);
  assert.equal(natal.birth_chart.utc_time, "2001-01-02T23:30:00.000Z");
  assert.ok(natal.verdict_signals);
  const transit = JSON.parse(
    (await sourceReading("get_current_transits", {}, birth)).content[0].text,
  );
  assert.equal(transit.gochara.length, 9);
  const horary = JSON.parse(
    (
      await sourceReading(
        "get_horary_prediction",
        { horary_number: 123, question_text: "Will it happen?" },
        birth,
      )
    ).content[0].text,
  );
  assert.equal(horary.horary_number, 123);
  const match = JSON.parse(
    (
      await sourceReading("get_match_report", {
        male_birth_date: "2001-01-03",
        male_birth_time: "05:00",
        male_location_name: "Delhi",
        female_birth_date: "2000-01-01",
        female_birth_time: "12:00",
        female_location_name: "Mumbai",
      })
    ).content[0].text,
  );
  assert.ok(match.compatibility);
});

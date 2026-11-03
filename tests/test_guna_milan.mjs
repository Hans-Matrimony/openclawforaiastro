import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { gunaMilan, moonAttributes } from "../extensions/reviewed-reading/direct/assets/dev-v2/guna-milan.mjs";
import { matchingBirth } from "../extensions/reviewed-reading/direct/assets/dev-v2/matching-birth.mjs";
import { geocode, get_match_report, get_horoscope_predictions } from "../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs";
import { sourceReading } from "../extensions/reviewed-reading/direct/source-engine.mjs";
import { createTools } from "../extensions/reviewed-reading/direct/tools.mjs";
import { sanitizeBindus, formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

const scores = result => result.factors.map(item => item.score);
const birth = {
  male_birth_date: "2001-01-03", male_birth_time: "05:00", male_location_name: "Delhi, Delhi, India",
  female_birth_date: "2000-01-01", female_birth_time: "12:00", female_location_name: "Mumbai, Maharashtra, India",
};

test("reference factor arithmetic, complete 36-point match and directional roles", () => {
  // Taurus Mrigashira groom and Taurus Rohini bride: same sign/lord/yoni,
  // different Nadi. Reverse roles lose one Gana point in the selected table.
  assert.deepEqual(scores(gunaMilan(54, 50)), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(gunaMilan(54, 50).display_score, "36/36");
  assert.equal(gunaMilan(50, 54).score_points, 35);
  assert.deepEqual(scores(gunaMilan(1, 351)), [0, 1, 3, 2, 5, 6, 0, 8]);
  assert.equal(gunaMilan(1, 351).score_points, 25);
  // Published table example Moon positions: Leo Uttara Phalguni and Taurus
  // Rohini; tabular Vashya=0 (not the conflicting 0.5 prose example).
  assert.deepEqual(scores(gunaMilan(148, 50)), [1, 0, 3, 1, 0, 6, 7, 8]);
  // Virgo Uttara Phalguni / Sagittarius Purva Ashadha: preserve the 0.5 Maitri.
  assert.deepEqual(scores(gunaMilan(150, 260)), [0, 1, 3, 2, 0.5, 6, 7, 8]);
  assert.equal(gunaMilan(150, 260).display_score, "27.5/36");
});

test("same-star Nadi is not automatically cancelled or converted to a perfect score", () => {
  const result = gunaMilan(1, 2);
  assert.equal(result.score_points, 28);
  assert.deepEqual(result.doshas, { nadi: true, bhakoot: false });
  assert.equal(result.exceptions_applied, false);
  assert.equal(result.factors[7].score, 0);
});

test("all 11,664 ordered pada pairs have eight bounded factors summing exactly to the total", () => {
  for (let male = 0; male < 108; male++) {
    for (let female = 0; female < 108; female++) {
      const result = gunaMilan((male + 0.5) * 10 / 3, (female + 0.5) * 10 / 3);
      assert.equal(result.factors.length, 8);
      assert.equal(result.factors.reduce((sum, item) => sum + item.max_score, 0), 36);
      assert.equal(result.factors.reduce((sum, item) => sum + item.score, 0), result.score_points);
      assert.ok(result.score_points >= 0 && result.score_points <= 36);
      for (const factor of result.factors) {
        assert.ok(factor.score >= 0 && factor.score <= factor.max_score);
        assert.ok(Number.isInteger(factor.score * 2));
      }
    }
  }
});

test("all 27 nakshatras and 12 signs handle boundaries without rounding the Moon display", () => {
  for (let star = 0; star < 27; star++) {
    const boundary = star * 40 / 3;
    assert.equal(moonAttributes(boundary).nakshatra_index, star);
    if (star) assert.equal(moonAttributes(boundary - 0.000001).nakshatra_index, star - 1);
    assert.equal(moonAttributes(boundary + 0.000001).pada, 1);
  }
  for (let sign = 1; sign < 12; sign++) {
    assert.equal(moonAttributes(sign * 30).sign_index, sign);
    assert.equal(moonAttributes(sign * 30 - 0.000001).sign_index, sign - 1);
  }
  assert.equal(moonAttributes(254.999999).vashya, "Manava");
  assert.equal(moonAttributes(255).vashya, "Chatushpada");
  assert.equal(moonAttributes(284.999999).vashya, "Chatushpada");
  assert.equal(moonAttributes(285).vashya, "Jalachara");
  assert.equal(moonAttributes(359.999999).nakshatra, "Revati");
  assert.equal(moonAttributes(359.99999999999994).nakshatra, "Revati");
  assert.equal(moonAttributes(13.333333333333332).nakshatra, "Ashwini");
  assert.equal(moonAttributes(40 / 3).nakshatra, "Bharani");
  for (const bad of [NaN, Infinity, -1, 360, null, undefined, "54", true]) {
    assert.throws(() => gunaMilan(bad, 50), /calculated sidereal Moon/);
    assert.throws(() => gunaMilan(54, bad), /calculated sidereal Moon/);
  }
});

test("symmetric factors and all seven hostile Yoni pairs are checked independently of role", () => {
  const yoniStar = [0, 1, 2, 3, 5, 6, 9, 11, 12, 13, 16, 19, 20, 22];
  for (const [first, second] of [[0, 8], [1, 13], [2, 11], [3, 12], [4, 10], [5, 6], [7, 9]]) {
    const m = (yoniStar[first] + 0.5) * 40 / 3;
    const f = (yoniStar[second] + 0.5) * 40 / 3;
    assert.equal(scores(gunaMilan(m, f))[3], 0);
    assert.equal(scores(gunaMilan(f, m))[3], 0);
  }
  for (let m = 0; m < 27; m++) {
    for (let f = 0; f < 27; f++) {
      const forward = scores(gunaMilan((m + 0.5) * 40 / 3, (f + 0.5) * 40 / 3));
      const reverse = scores(gunaMilan((f + 0.5) * 40 / 3, (m + 0.5) * 40 / 3));
      for (const index of [1, 2, 3, 4, 6, 7]) assert.equal(forward[index], reverse[index]);
    }
  }
});

test("exact birthplace resolution, leap dates and both partners' missing or invalid details fail closed", async () => {
  const result = matchingBirth("2000-02-29", "12:00 AM", "Delhi, Delhi, India", geocode);
  assert.equal(result.utc.toISOString(), "2000-02-28T18:30:00.000Z");
  assert.equal(result.loc.timezone, "Asia/Kolkata");
  assert.equal(matchingBirth("01/01/2000", "12:00 PM", "Mumbai", geocode).utc.toISOString(), "2000-01-01T06:30:00.000Z");
  for (const role of ["male", "female"]) {
    for (const [key, value] of [
      ["birth_date", "2001-02-29"], ["birth_date", "31/04/2000"], ["birth_date", ""],
      ["birth_date", "2999-01-01"], ["birth_date", "1899-01-01"],
      ["birth_time", "24:00"], ["birth_time", "12:60"], ["birth_time", "0:30 PM"],
      ["birth_time", "unknown"], ["birth_time", undefined],
      ["location_name", "Delhi, USA"], ["location_name", "New"],
      ["location_name", "Delhi, Maharashtra, India"], ["location_name", "Delhi somewhere"],
      ["location_name", ""],
    ]) {
      const input = { ...birth, [`${role}_${key}`]: value };
      assert.throws(() => get_match_report(input), /birth|Birth|Invalid/);
      await assert.rejects(sourceReading("get_match_report", input), /birth|Birth|Invalid/);
    }
  }
  assert.throws(() => get_match_report({ ...birth, female_birth_date: null }), /Both partners/);
});

test("matching uses real historical zones for DST and rejects ambiguous/nonexistent local times", () => {
  const utc = (date, time, place) => matchingBirth(date, time, place, geocode).utc.toISOString();
  assert.equal(utc("2000-07-01", "12:00", "New York, USA"), "2000-07-01T16:00:00.000Z");
  assert.equal(utc("2000-01-01", "12:00", "New York, USA"), "2000-01-01T17:00:00.000Z");
  assert.equal(utc("2000-07-01", "12:00", "London, UK"), "2000-07-01T11:00:00.000Z");
  assert.equal(utc("2000-01-01", "12:00", "Sydney, Australia"), "2000-01-01T01:00:00.000Z");
  assert.equal(utc("2000-01-01", "12:00", "Kathmandu, Nepal"), "2000-01-01T06:15:00.000Z");
  assert.equal(utc("1900-01-01", "12:00", "Delhi"), "1900-01-01T06:38:50.000Z");
  for (const [date, time] of [["2000-04-02", "02:30"], ["2000-10-29", "01:30"]]) {
    assert.throws(() => utc(date, time, "New York"), /ambiguous or nonexistent/);
  }
});

test("every existing supported city has an explicit matching timezone/region policy", () => {
  const engine = readFileSync(new URL("../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs", import.meta.url), "utf8");
  const citiesBlock = engine.slice(engine.indexOf("const CITIES ="), engine.indexOf("export function geocode"));
  const cities = [...citiesBlock.matchAll(/\["([^"]+)",/g)].map(match => match[1]);
  assert.ok(cities.length > 50);
  for (const city of cities) {
    assert.ok(matchingBirth("2000-01-01", "12:00", city, geocode).utc instanceof Date, city);
  }
});

test("real matching tool and app adapter deliver the calculated score without a network call", async () => {
  const report = JSON.parse((await sourceReading("get_match_report", birth)).content[0].text);
  assert.equal(report.engine, "local-sweph-v2");
  assert.equal(report.guna_milan.score_max, 36);
  assert.equal(report.guna_milan.status, "ok");
  assert.equal(report.male_chart.utc_time, "2001-01-02T23:30:00.000Z");
  assert.equal(report.female_chart.utc_time, "2000-01-01T06:30:00.000Z");
  assert.ok(report.compatibility.male_7th_house);
  const execute = createTools({ memory: {}, env: {}, fetchImpl: () => { throw new Error("No network"); } });
  const actual = JSON.parse(await execute("mcp__VedAstro__get_match_report", birth));
  assert.deepEqual(actual.guna_milan, report.guna_milan);
  assert.match(report.instruction, /exact guna_milan.display_score/);
  assert.doesNotMatch(report.instruction, /NEGATIVE bolo/);
  const displayed = formatDisplayReply(sanitizeBindus(`Guna Milan ${report.guna_milan.display_score}.`));
  assert.match(displayed, new RegExp(`${report.guna_milan.score_points}/36`));
});

test("matching is date-independent and preserves natal tool output and inputs", () => {
  const input = { ...birth };
  const natal = { birth_date: "3/1/2001", birth_time: "05:00", location_name: "Delhi" };
  const before = get_horoscope_predictions(natal);
  const first = JSON.parse(get_match_report(input).content[0].text).guna_milan;
  const second = JSON.parse(get_match_report(input).content[0].text).guna_milan;
  assert.deepEqual(first, second);
  assert.deepEqual(input, birth);
  assert.deepEqual(get_horoscope_predictions(natal), before);
});

test("full agent tool cycle displays calculated points; it does not invent a partner or convert a percent", async () => {
  const input = { ...birth };
  const expected = JSON.parse((await sourceReading("get_match_report", input)).content[0].text).guna_milan;
  let calls = 0;
  const result = await directAnswer({
    user_id: "synthetic-matching", query: "Hum dono ka Guna Milan kitna hai?", language: "hinglish",
    history: [], birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
  }, {
    env: { OPENROUTER_API_KEY: "synthetic", VEDASTRO_DIRECT_ENVIRONMENT: "development", VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_REPLY_CACHE: "0", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0" },
    makeMemory: () => ({ read: async () => [], write: async () => ({ saved: true }) }),
    fetchImpl: async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      let message;
      if (calls === 1) {
        message = { role: "assistant", content: null, tool_calls: [{ id: "synthetic-match", type: "function", function: { name: "mcp__VedAstro__get_match_report", arguments: JSON.stringify(input) } }] };
      } else {
        assert.equal(calls, 2);
        const evidence = JSON.parse(body.messages.findLast(item => item.role === "tool").content);
        assert.deepEqual(evidence.guna_milan, expected);
        message = { role: "assistant", content: `Guna Milan ${expected.display_score} hai. Nadi ${expected.factors[7].score}/8 aur Bhakoot ${expected.factors[6].score}/7 hain.\n\nYeh paramparik milan score hai, rishte ki guarantee nahi.` };
      }
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message, finish_reason: calls === 1 ? "tool_calls" : "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    },
  });
  assert.equal(calls, 2);
  assert.ok(result.reply.includes(expected.display_score));
  assert.ok(result.answer_reading_tools.includes("get_match_report"));
  await assert.rejects(sourceReading("get_match_report", { ...birth, female_birth_time: "" }, {
    date: "2001-01-03", time: "05:00", location_name: "Delhi",
  }), /Invalid birth time/);
});

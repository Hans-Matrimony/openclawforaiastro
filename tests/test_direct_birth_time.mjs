import test from "node:test";
import assert from "node:assert/strict";
import { birthUtc } from "../extensions/reviewed-reading/direct/birth-time.mjs";
import { sourceReading } from "../extensions/reviewed-reading/direct/source-engine.mjs";

void test("date-specific birth offsets cover India, negative offsets, quarter hours and daylight saving", () => {
  for (const [city, offset, date, time, expected] of [
    ["Delhi", "+05:30", "3/1/2001", "05:00", "2001-01-02T23:30:00.000Z"],
    ["New York", "-05:00", "1/1/2000", "12:00", "2000-01-01T17:00:00.000Z"],
    ["New York", "-05:00", "1/7/2000", "12:00", "2000-07-01T16:00:00.000Z"],
    ["London", "+00:00", "1/7/2000", "12:00", "2000-07-01T11:00:00.000Z"],
    ["Sydney", "+10:00", "1/1/2000", "12:00", "2000-01-01T01:00:00.000Z"],
    ["Kathmandu", "+05:45", "1/1/2000", "12:00", "2000-01-01T06:15:00.000Z"],
  ]) {
    assert.equal(
      birthUtc(date, time, { name: city, tzOffset: offset }).utc.toISOString(),
      expected,
      city,
    );
  }
});

void test("nonexistent and repeated birth clock times are not silently guessed", () => {
  const location = { name: "New York", tzOffset: "-05:00" };
  assert.throws(() => birthUtc("8/3/2026", "02:30", location), { code: "birth_time_nonexistent" });
  assert.throws(() => birthUtc("1/11/2026", "01:30", location), { code: "birth_time_ambiguous" });
  assert.equal(
    birthUtc("1/11/2026", "01:30 -04:00", location).utc.toISOString(),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(
    birthUtc("1/11/2026", "01:30 -05:00", location).utc.toISOString(),
    "2026-11-01T06:30:00.000Z",
  );
  assert.throws(() => birthUtc("1/11/2026", "01:30 +05:30", location), {
    code: "birth_offset_mismatch",
  });
});

void test("actual chart uses corrected UTC and reports the birth-date offset", async () => {
  for (const [location_name, expected, offset] of [
    ["New York", "2000-07-01T16:00:00.000Z", "-04:00"],
    ["London", "2000-07-01T11:00:00.000Z", "+01:00"],
    ["Delhi", "2000-07-01T06:30:00.000Z", "+05:30"],
  ]) {
    const packet = JSON.parse(
      (
        await sourceReading(
          "get_horoscope_predictions",
          {},
          { date: "2000-07-01", time: "12:00", location_name },
        )
      ).content[0].text,
    );
    assert.equal(packet.birth_chart.utc_time, expected);
    assert.equal(packet.birth_chart.location_used.tzOffset, offset);
    assert.equal(packet.ashtakavarga.grand_total, 337);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { unsupportedHouseClaim } from "../extensions/reviewed-reading/direct/placement-quality.mjs";

const packets = [
  {
    birth_chart: {
      planets: [
        "Jupiter: Aries 30.00° | house 2 | Test",
        "Mercury: Sagittarius 240.00° | house 10 | Test",
        "Saturn: Aries 35.00° | house 2 | Test",
      ],
    },
    gochara: [{ planet: "Jupiter", over_natal_house: 5 }],
  },
];
void test("the observed combined education placement cannot turn Jupiter into a tenth-house occupant", () => {
  assert.ok(
    unsupportedHouseClaim(
      "Tumhare chart mein education ka kaam Jupiter aur Mercury se joda hua hai, dono hi 10th house mein hain.",
      packets,
    ),
  );
  assert.equal(
    unsupportedHouseClaim("Mercury 10th house mein hain. Jupiter house 2 mein hain.", packets),
    null,
  );
  assert.equal(
    unsupportedHouseClaim("Jupiter ka sahyog hai, Mercury 10th house mein hain.", packets),
    null,
  );
  assert.equal(
    unsupportedHouseClaim("Current transit mein Jupiter 5th house mein hain.", packets),
    null,
  );
  assert.ok(unsupportedHouseClaim("Current transit mein Jupiter 2nd house mein hain.", packets));
  assert.equal(unsupportedHouseClaim("Jupiter ki drishti house 10 par hai.", packets), null);
  assert.equal(unsupportedHouseClaim("House 10 ke lord Jupiter hain.", packets), null);
  assert.equal(unsupportedHouseClaim("Rahu 10th house mein hain.", []), null);
  assert.equal(
    unsupportedHouseClaim("Natal Jupiter house 10 mein hain.", [
      ...packets,
      { birth_chart: { planets: ["Jupiter: Sagittarius 240.00° | house 10 | Test"] } },
    ]),
    null,
  );
});

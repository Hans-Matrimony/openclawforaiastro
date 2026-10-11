const metadata = {
  schema: "reviewed-vedha-geometry-v1",
  source_revision: "40763952742f76369a505d8db2e9e9fa67f75d78",
  table_method: "Calculate.Vedhanka",
  table_selection: "pinned_upstream_first_match",
  occupancy_method: "Calculate.PlanetsInGocharaHouse",
  occupancy_correction: "query_obstruction_house",
  planet_scope: "seven_classical_planets",
  house_reference: "natal_moon_whole_sign",
  event_prediction_available: false,
};

// First-match points in the pinned native table, including Venus overlaps.
const points = {
  Sun: { 11: 5, 3: 9, 10: 4, 6: 12, 5: 11, 9: 3, 4: 10, 12: 6 },
  Moon: { 7: 2, 1: 5, 6: 12, 11: 8, 10: 4, 3: 9, 2: 7, 5: 1, 12: 6, 8: 11, 4: 10, 9: 3 },
  Mars: { 3: 12, 11: 5, 6: 9, 12: 3, 5: 11, 9: 6 },
  Mercury: { 2: 5, 4: 3, 6: 9, 8: 1, 10: 7, 11: 12, 5: 2, 3: 4, 9: 6, 1: 8, 7: 10, 12: 11 },
  Jupiter: { 2: 12, 11: 8, 9: 10, 5: 4, 7: 3, 12: 2, 8: 11, 10: 9, 4: 5, 3: 7 },
  Venus: { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 6, 12: 3, 7: 2, 10: 4, 6: 11 },
  Saturn: { 3: 12, 11: 5, 6: 9, 12: 3, 5: 11, 9: 6 },
};
const exempt = { Sun: ["Saturn"], Saturn: ["Sun"], Moon: ["Mercury"], Mercury: ["Moon"] };
const compareNames = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const sameKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).toSorted(compareNames).join("|") ===
    [...keys].toSorted(compareNames).join("|");
const sameList = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((value, index) => value === expected[index]);

export function validVedhaGeometry(bundle, transits) {
  try {
    if (
      !sameKeys(bundle, [...Object.keys(metadata), "planets"]) ||
      Object.entries(metadata).some(([key, value]) => bundle[key] !== value) ||
      !sameKeys(bundle.planets, Object.keys(points))
    ) {
      return false;
    }
    for (const [name, table] of Object.entries(points)) {
      const house = transits[name].house_from_natal_moon;
      const point = table[house] ?? 0;
      const occupants = Object.keys(points).filter(
        (other) => point !== 0 && transits[other].house_from_natal_moon === point,
      );
      const exemptions = exempt[name] ?? [];
      const ignored = occupants
        .filter((other) => exemptions.includes(other))
        .toSorted(compareNames);
      const blockers = occupants
        .filter((other) => other !== name && !exemptions.includes(other))
        .toSorted(compareNames);
      const row = bundle.planets[name];
      if (
        !sameKeys(row, [
          "house_from_natal_moon",
          "obstruction_house_from_natal_moon",
          "obstructing_planets",
          "exempt_planets_at_point",
          "obstructed",
        ]) ||
        !Number.isInteger(house) ||
        house < 1 ||
        house > 12 ||
        row.house_from_natal_moon !== house ||
        row.obstruction_house_from_natal_moon !== point ||
        row.obstructed !== blockers.length > 0 ||
        !sameList(row.obstructing_planets, blockers) ||
        !sameList(row.exempt_planets_at_point, ignored)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

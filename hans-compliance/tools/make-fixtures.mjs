// Rebuilds hans-compliance/fixtures from the rahunova-re captured VedAstro responses.
// Usage: node hans-compliance/tools/make-fixtures.mjs <capture-dir> <out-dir>
//   e.g. node hans-compliance/tools/make-fixtures.mjs ../rahunova-re hans-compliance/fixtures

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [capDir, outDir] = process.argv.slice(2);
if (!capDir || !outDir) {
  console.error("usage: make-fixtures.mjs <capture-dir> <out-dir>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

// 1) Marriage-topic slice from the HoroscopePredictions capture.
const horo = JSON.parse(readFileSync(join(capDir, "real-horo.json"), "utf8"));
const kw = /marri|wife|spouse|partner|relationship|love|romance|seventh|house7/i;
const hits = horo.Payload.filter((x) =>
  kw.test([x.Name, x.Description, (x.Tags || []).join(" ")].join(" ")),
);
const items = hits.slice(0, 18).map((x) => ({
  Name: x.Name,
  Description: x.Description.trim(),
  Planets: x.RelatedBody.Planets,
  Houses: x.RelatedBody.Houses,
  Zodiacs: x.RelatedBody.Zodiacs,
  Tags: x.Tags,
}));
writeFileSync(
  join(outDir, "marriage-predictions.json"),
  JSON.stringify(
    {
      Source: "VedAstro HoroscopePredictions live capture (rahunova-re/real-horo.json), 2026-10-12",
      Birth: "19:45 14/06/1996 +05:30 Kanpur (test person)",
      Ayanamsa: "RAMAN",
      TotalPredictions: horo.Payload.length,
      Included: items.length,
      Items: items,
    },
    null,
    1,
  ),
);
console.log(`marriage-predictions.json: ${items.length}/${horo.Payload.length} predictions`);

// 2) Compact per-planet snapshot from the AllPlanetData capture.
const planetsRaw = JSON.parse(readFileSync(join(capDir, "real-planets.json"), "utf8"));
const all = planetsRaw.Payload.AllPlanetData;

function compactPlanet(obj) {
  const keys = Object.keys(obj);
  const exact = (cands) => {
    for (const c of cands) {
      const k = keys.find((kk) => kk.toLowerCase() === c);
      if (k != null) {
        return obj[k];
      }
    }
    return null;
  };
  const fuzzy = (re, notRe) => {
    const k = keys.find((kk) => re.test(kk) && !(notRe && notRe.test(kk)));
    return k ? obj[k] : null;
  };
  return {
    sign:
      exact(["planetrasid1sign", "sign", "zodiacsign", "rashi"]) ??
      fuzzy(/rasi|zodiac/i, /lord|house|amsha|old|aspect/),
    house:
      exact(["houseplanetoccupiesbasedonsign"]) ??
      fuzzy(/houseplanetoccupiesbasedon/i, /longitude/),
    nakshatra: exact(["nakshatra"]) ?? fuzzy(/nakshatra/i, /lord/),
    dignity: exact(["dignity"]) ?? fuzzy(/dignity/i, null),
    retrograde: exact(["isretrograde", "isretro"]) ?? fuzzy(/retro/i, null),
  };
}

const compact = {};
for (const entry of all) {
  const name = Object.keys(entry)[0];
  compact[name] = compactPlanet(entry[name]);
}
writeFileSync(
  join(outDir, "planets-slice.json"),
  JSON.stringify(
    {
      Source: "VedAstro AllPlanetData live capture (rahunova-re/real-planets.json), 2026-10-12",
      Birth: "19:45 14/06/1996 +05:30 Kanpur (test person)",
      Planets: compact,
    },
    null,
    1,
  ),
);
console.log(
  `planets-slice.json: ${Object.keys(compact).length} planets — Sun: ${JSON.stringify(compact.Sun)}`,
);

// 3) SYNTHETIC dasa structure — clearly labelled, illustrative values only.
writeFileSync(
  join(outDir, "dasa-ranges.json"),
  JSON.stringify(
    {
      Source:
        "SYNTHETIC fixture — illustrative values only, NOT a real chart result. Replace with a live DasaAtRange capture before trusting timing accuracy.",
      Levels: ["Mahadasa", "Bhukti"],
      Ranges: [
        { Lord: "Venus", Level: "Mahadasa", From: "2019", To: "2039" },
        { Lord: "Jupiter", Level: "Bhukti", From: "Nov 2031", To: "Jul 2034" },
        { Lord: "Saturn", Level: "Bhukti", From: "Sep 2027", To: "Nov 2028" },
      ],
    },
    null,
    1,
  ),
);
console.log("dasa-ranges.json: synthetic (labelled in file)");

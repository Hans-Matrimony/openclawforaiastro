// Keep the supplied calculation/judgment code unchanged; adapt only input formatting.
function sourceDate(value) {
  const text = String(value ?? "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  const parts = iso ? [+iso[1], +iso[2], +iso[3]] : dmy ? [+dmy[3], +dmy[2], +dmy[1]] : [];
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid birth date");
  }
  return `${day}/${month}/${year}`;
}

function sourceTime(value) {
  const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(String(value ?? "").trim());
  if (!match) {
    throw new Error("Invalid birth time");
  }
  let hour = +match[1];
  if (+match[2] > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) {
    throw new Error("Invalid birth time");
  }
  if (match[3]) {
    hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  }
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export async function sourceReading(
  name,
  args,
  birth,
  { loadEngine = () => import("./assets/dev-v2/engine.mjs"), rawSource = false } = {},
) {
  const input = { ...args };
  if (name === "get_match_report") {
    for (const person of ["male", "female"]) {
      input[`${person}_birth_date`] = sourceDate(input[`${person}_birth_date`]);
      input[`${person}_birth_time`] = sourceTime(input[`${person}_birth_time`]);
    }
  } else if (name !== "get_horary_prediction") {
    input.birth_date = sourceDate(input.birth_date || birth?.date);
    input.birth_time = sourceTime(input.birth_time || birth?.time);
    input.location_name ||= input.birth_location_name || birth?.location_name || birth?.place;
    if (!input.location_name) {
      throw new Error("Birth location missing");
    }
  } else {
    input.location_name ||= birth?.location_name || birth?.place;
  }
  const engine = await loadEngine();
  if (!Object.hasOwn(engine, name) || typeof engine[name] !== "function") {
    throw new Error("Unknown source reading");
  }
  const result = await engine[name](input);
  if (name !== "get_horoscope_predictions") {
    return result;
  }
  // Keep the upstream calculations intact; adapt its UI instructions to our
  // existing reading contract without injecting its example date or a closing.
  let changed = false;
  const adapted = {
    ...result,
    content: result.content.map((part) => {
      if (part.type !== "text") {
        return part;
      }
      let data;
      try {
        data = JSON.parse(part.text);
      } catch {
        return part;
      }
      if (!Array.isArray(data.dasha?.upcoming_antardashas)) {
        return part;
      }
      const sourceStyle =
        "Use verdict_signals ke positive/negative factors se seedha topic-specific verdict do: negative factors zyada hain to negative, mixed hain to mixed. JAWAB CHHOTA RAKHO: 3-4 chhoti lines, direct answer aur sirf relevant chart reason; no report or generic reassurance. For timing, consider upcoming_antardashas and next_mahadasha, not a default current-period end year. These are period boundaries, not guaranteed event dates or automatically favorable windows. Any suggested period is an interpretation, not a calculated event date; explain its topic-specific support and do not invent missing dates or factors. For fields/choices questions answer the choices, without an unsolicited year. Use the existing two-part reading format: explanation then short verdict. This result already contains the period schedule; do not call the same tool again for unchanged inputs. Another tool is needed only for missing evidence. Keep technical scores internal and leave the friendly follow-up to the separate companion stage.";
      data.instruction = rawSource
        ? sourceStyle
        : "Use verdict_signals and the calculated chart to explain this question's positive, negative or mixed indication. For timing, consider upcoming_antardashas and next_mahadasha; do not default to the current antardasha end year or reuse another topic's date. These are period boundaries, not guaranteed event dates or automatically favorable windows. Name a month-year window only when the chart supports its relevance to this topic; explain the specific supporting reason. Do not invent missing dates or a favorable period. Follow the existing two-part reading format and display terminology rules. Reuse this tool result for the same birth inputs in this turn; call another tool only for genuinely missing evidence. Do not generate the companion follow-up here.";
      data.evidence_scope = {
        placements:
          "birth_chart contains natal placements only; current house transits require get_current_transits",
        timing:
          "dasha dates are calculated period boundaries; this tool does not calculate event-specific windows",
        interpretation:
          "verdict_signals describe current topic factors, not future period scores; a new period alone does not establish improvement",
      };
      changed = true;
      return { ...part, text: JSON.stringify(data) };
    }),
  };
  return changed ? adapted : result;
}

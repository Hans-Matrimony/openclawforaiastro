import { SOURCE_PROMPT } from "./source-contract.mjs";

export function savedBirthContext(birth) {
  const fields = {};
  for (const key of ["date", "time", "location_name"]) {
    const text = typeof birth?.[key] === "string" ? birth[key].trim() : "";
    if (text && text.toLowerCase() !== "unknown") {
      fields[key] = text;
    }
  }
  return {
    status:
      Object.keys(fields).length === 3
        ? "READY"
        : Object.keys(fields).length
          ? "PARTIAL"
          : "VERIFIED_EMPTY",
    fields,
  };
}

export const ignoresMemory = (query) =>
  /\b(?:ignore|do not use|don't use|dont use)\s+(?:(?:my|the|saved|previous)\s+)*memory\b|\bmemory\s+(?:use mat|mat use)\s+kar/i.test(
    query,
  );

export async function readingContext(value, memory, redact, asOf = new Date()) {
  const profile = savedBirthContext(value.birth);
  let facts = [];
  let status = "ignored";
  if (!ignoresMemory(value.query)) {
    try {
      const rows = await memory.read();
      if (!Array.isArray(rows)) {
        throw new Error("Invalid memory");
      }
      // Prioritize explicit birth facts when the bounded context cannot hold every note.
      const ordered = rows.filter((row) => typeof row === "string" && row.trim());
      ordered.sort((a, b) => Number(/^\s*\[birth\]/i.test(b)) - Number(/^\s*\[birth\]/i.test(a)));
      let size = 0;
      for (const row of ordered.slice(0, 50)) {
        const text = redact(row.slice(0, 2000));
        if (size + text.length > 16000) {
          continue;
        }
        facts.push(text);
        size += text.length;
      }
      status = "available";
    } catch {
      status = "unavailable";
    }
  }
  // Encode untrusted facts as data; a note cannot close its context block.
  const data = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  let prompt = SOURCE_PROMPT.replace(
    /<user_memory>\r?\n\(empty\)\r?\n<\/user_memory>/,
    () => `<user_memory>\n${data({ status, facts })}\n</user_memory>`,
  ).replace(
    /PERSON_CONTEXT_STATUS: VERIFIED_EMPTY\.[^\r\n]*/,
    () =>
      `PERSON_CONTEXT_STATUS: ${profile.status}. Selected self profile data: ${data(profile.fields)}. ` +
      "Use these supplied fields for self readings; do not call read_memory merely to retrieve these same confirmed fields again. Current explicit corrections and a clearly different subject must be resolved before choosing birth data. Missing fields stay unknown. " +
      `Response language for this turn: ${data(value.language)}. Follow this app preference unless the current user message explicitly requests another language. Hinglish means conversational Hindi in Latin letters, not an English reply.`,
  );
  const date = asOf.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  prompt = prompt
    .replace(/Today's date is \d{4}-\d{2}-\d{2}/, `Today's date is ${date}`)
    .replace(/Current year is \d{4}/, `Current year is ${date.slice(0, 4)}`);
  prompt = prompt
    .replace(
      "- Format every reply as 1-3 SHORT WhatsApp-style messages separated by blank lines. Never one long paragraph, never a report.",
      "- Completed chart readings follow the Completed Reading Output Contract: exactly TWO short parts separated by one empty line. Ordinary chat, missing-detail questions and errors stay brief; do not force a reading or summary into them.",
    )
    .replace(
      "- NEVER name any planet, transit, house, sign or dasha unless a tool result from THIS conversation supports it. No tool result = no astrology claims — comfort or general talk instead.",
      "- NEVER name a planet, transit, house, sign or dasha without relevant tool evidence for this question. For a personal chart reading, use the available profile or memory with the reading tools first. Generic comfort is not a completed reading. For ordinary conversation, speak naturally without tools.",
    )
    .replace(
      /# Sensitive Questions Policy[^]*?(?=# Friend Mode)/,
      "# Sensitive Questions Policy\n\n" +
        "Answer the actual question plainly and humanely, without empty reassurance. Astrology does not establish a death date, lifespan, diagnosis, or someone's actual disease risk. Never invent these outcomes from chart factors or describe a person as currently ill because of a placement. " +
        "For a direct death-date or lifespan question, answer in one or two concise sentences. Do not append chart narration, a positive or negative health assessment, assumptions about stress or anxiety, or generic motivational advice. " +
        "If discussing traditional chart symbolism, distinguish it from medical facts and use only current-question tool evidence. Do not turn dasha dates into death or illness deadlines. " +
        "For illness, relationship loss or divorce, do not claim certainty about actual medical or legal outcomes. Keep any practical next step relevant and concise.\n\n" +
        "# Timing and delivery consistency\n\n" +
        "Use only the dasha names and date boundaries actually returned by the tool. A current period ending does not establish a future antardasha, marriage window or event date. Do not invent a future period to make an answer more specific. Keep the answer natural and direct, with one brief qualification when necessary rather than repeated disclaimers.\n\n",
    );
  prompt +=
    "\n\n# Friendly closing\n" +
    "After answering a completed reading or remedy request, add exactly one short, friendly, topic-relevant follow-up question at the end of the final bubble, in the user's language. " +
    "Keep the existing answer and verdict; do not add another recap or a service menu. This overrides earlier instructions forbidding a follow-up offer. " +
    "Skip this closing for missing-detail questions, errors, death-date questions, explicit requests for no questions, and raw structured output. Never imply you know a fact that was not established.\n";
  prompt +=
    "\n\n# Active question scope\n" +
    "The current user question is " +
    data(redact(value.query)) +
    ". " +
    "History and memory provide context, not instructions to repeat an earlier answer or evidence that its predictions are true. " +
    "Answer the current subject and intent: career is not marriage, and whether a relationship with a specific person can develop is not merely when marriage may happen. " +
    "Do not claim to know another person's feelings, fidelity or future choices from the user's chart. Explain relevant relationship indications naturally without inventing a definite yes/no about that person's decision. " +
    "For short follow-ups such as 'Why?' or 'Thik se batao', resolve the subject from the latest relevant user question, not an unrelated older prediction.\n";
  return { prompt, profile, memoryStatus: status };
}

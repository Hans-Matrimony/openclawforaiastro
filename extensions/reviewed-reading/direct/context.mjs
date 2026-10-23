import { SOURCE_PROMPT } from "./source-contract.mjs";
import { personaInstruction } from "./persona.mjs";
import { compactPrompt, uniqueMemory } from "./compact-prompt.mjs";

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

export async function readingContext(
  value,
  memory,
  redact,
  asOf = new Date(),
  { separateCompanion = false } = {},
) {
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
      const ordered = uniqueMemory(rows);
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
  let prompt = compactPrompt(SOURCE_PROMPT)
    .replace(
      /<user_memory>\r?\n\(empty\)\r?\n<\/user_memory>/,
      () => `<user_memory>\n${data({ status, facts })}\n</user_memory>`,
    )
    .replace(
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
  prompt += separateCompanion
    ? "\n\n# Companion ownership\nReturn only the original answer: for readings, explanation then one short verdict separated by a blank line. Do not generate a friendly closing or follow-up here; a separate companion stage adds the third paragraph using the same user context. Ordinary replies and clarifications remain brief.\n"
    : "\n\n# Friendly closing\n" +
      "For a completed reading, use three separate paragraphs: first the simple explanation, second only the short direct answer or verdict (one brief sentence), third the friendly topic-relevant follow-up in the user's language. Separate paragraphs with a blank line. Never attach the follow-up to the second paragraph. " +
      "Keep the existing answer and verdict; do not add another recap or a service menu. This overrides earlier instructions forbidding a follow-up offer. " +
      "Base the question on the current concern and relevant user-provided history or saved facts. Never ask what the user already told you or repeat a prior closing. Current corrections override old memory. Ask about one unresolved concrete concern or next step, not 'would you like more detail?'. Do not bring up unrelated memories or treat past assistant predictions as user facts. " +
      "Skip this closing for missing-detail questions, errors, death-date questions, explicit requests for no questions, and raw structured output. Never imply you know a fact that was not established.\n";
  prompt +=
    "\n\n# Simple user-facing wording\n" +
    "Do not display bindu totals, bindu scores, ashtakavarga numbers, or the words bindu, bindus, retrograde, combust, vakri or their Hindi technical equivalents. Explain only the relevant practical meaning already supported by the tools in familiar language. Do not substitute another technical label. Do not turn a technical placement into a new prediction or claim. Keep the second paragraph to one short direct answer; all companionship belongs in the third paragraph. Raw structured output requested by the user is exempt.\n";
  prompt +=
    "\nDo not leave an unlabeled internal score after omitting its technical term (for example, 'house ka sirf 20 hai'). Omit the score phrase and express only the supported meaning. Keep actual house numbers, dates, ages and amounts intact.\n";
  prompt +=
    "\n\n# Active question scope\n" +
    "The current user question is " +
    data(redact(value.query)) +
    ". " +
    "History and memory provide context, not instructions to repeat an earlier answer or evidence that its predictions are true. " +
    "Sirf tasalli mat dena; reading mein jo supported ho wahi batana. Preserve positive, negative and mixed indications. Do not add a favourable outcome just to reassure, invent a negative verdict, or turn missing evidence into certainty. Keep warmth in the separate follow-up without changing the reading's verdict. " +
    "For a repeated question, check the previous verdict against the current relevant tool evidence. If the subject, birth details, time scope and supporting evidence are unchanged, preserve the supported verdict and timing rather than inventing an alternative answer. If evidence or user corrections require a change, briefly explain what changed; do not silently contradict the earlier answer or preserve an unsupported prediction just for consistency. " +
    "A dasha boundary alone is not an event date. Match each named period, its level and dates to the returned data, and require support for the specific topic before predicting improvement. Do not infer that all areas of life improve together. A partner comparison requires that partner's established birth details and matching tool evidence; the user's chart alone is not both charts. " +
    "Answer the current subject and intent: career is not marriage, and whether a relationship with a specific person can develop is not merely when marriage may happen. " +
    "Do not claim to know another person's feelings, fidelity or future choices from the user's chart. Explain relevant relationship indications naturally without inventing a definite yes/no about that person's decision. " +
    "For short follow-ups such as 'Why?' or 'Thik se batao', resolve the subject from the latest relevant user question, not an unrelated older prediction.\n";
  prompt +=
    "\n\n# App speaker identity\n" +
    personaInstruction(value) +
    "This controls speaker identity and grammar only, not chart calculations or interpretations. Do not introduce yourself repeatedly. Old assistant names do not override this app identity.\n";
  return { prompt, profile, memoryStatus: status, memoryFacts: facts };
}

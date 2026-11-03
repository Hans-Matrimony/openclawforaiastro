import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE_TOOLS } from "./source-contract.mjs";
import { sourceReading } from "./source-engine.mjs";
import { selectedSelfBirth, selectedSelfArguments } from "./selected-self-birth.mjs";
import { matchingEvidence, sameBirth, suppliedBirth } from "./birth-evidence.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets");
const PREFIX = "mcp__VedAstro__";
const CHART_TOOLS = new Set([
  "get_horoscope_predictions",
  "get_current_transits",
  "get_match_report",
  "get_horary_prediction",
]);
export const TOOLS = SOURCE_TOOLS;

const convertDate = (value) =>
  String(value ?? "").replace(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    (_, d, m, y) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
  );

export function localChart(dob, tob, place, query, { env = process.env, signal } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      path.join(ROOT, "engine/calculate.py"),
      "--dob",
      dob,
      "--tob",
      tob,
      "--place",
      place,
    ];
    if (/kb|kab|when|timing|date|2027|2028|2029/i.test(query)) {
      args.push("--reading-intent", "timing");
    }
    execFile(
      env.VEDASTRO_DIRECT_PYTHON || "python3",
      args,
      { cwd: ROOT, timeout: 60000, maxBuffer: 131072, windowsHide: true, signal },
      (error, stdout) => {
        if (error) {
          return reject(new Error("Local chart unavailable", { cause: error }));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("Invalid local chart"));
        }
      },
    );
  });
}

export function createTools({
  memory,
  birth,
  query,
  history = [],
  gender = 'unknown',
  profileUpdateStatus,
  selectedSelfQuery,
  env = process.env,
  signal,
  fetchImpl = fetch,
  chart = localChart,
  reading = sourceReading,
  now = () => new Date(),
}) {
  // Request-scoped state replaces the source app's shared single-user store.
  const store = { birth: birth ? { ...birth } : null, selectedPerson: null };
  const selfBirth = ['saved', 'needs_confirmation', 'unavailable'].includes(profileUpdateStatus)
    ? birth : selectedSelfBirth(selectedSelfQuery ?? query, birth);
  let initialized = false;
  async function rpc(payload) {
    const response = await fetchImpl("https://mcp-subagent.vedastro.org/api/mcp/public", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)].filter(Boolean)),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Reading tool unavailable");
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > 131072) {
      throw new Error("Reading tool response too large");
    }
    const line = text.split("\n").find((l) => l.startsWith("data: "));
    return JSON.parse(line ? line.slice(6) : text);
  }
  return async (advertisedName, args = {}) => {
    const name = advertisedName.replace(PREFIX, "");
    if (name === "get_current_datetime") {
      const date = now();
      return {
        datetime: date.toISOString(),
        local_date: date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
        local_time: date.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      };
    }
    if (name === "read_memory") {
      const facts = await memory.read();
      // Saved profile data is available through the source memory tool, never a second system prompt.
      const selected = store.birth ? ["[selected_birth] " + JSON.stringify(store.birth)] : [];
      return [...selected, ...facts].join("\n") || "(empty)";
    }
    if (name === "update_memory") {
      const content = args.memory_text ?? args.text;
      const birthLine = line => /\[birth\]|\b(?:born|birth|dob|tob|janam|janm|dateOfBirth|timeOfBirth|birthPlace)\b/i.test(line);
      if (typeof content === 'string' && content.split(/\r?\n/).some(birthLine)) {
        // The imported tool describes replacement, but this app's Mem0 endpoint
        // appends. Never append a conflicting birth record and call it a profile
        // update. Confirmed self changes are owned by the app metadata store.
        const otherFacts = content.split(/\r?\n/).filter(line => !birthLine(line)).join('\n').trim();
        if (otherFacts) await memory.write(otherFacts);
        return {saved: false, other_memory_saved: !!otherFacts, profile_saved: profileUpdateStatus === 'saved',
          reason: 'Birth changes use the app confirmed-profile flow. No birth memory was appended. Other non-birth memory lines, if present, were saved separately. Do not claim a birth memory or app profile update unless profile_saved is true.'};
      }
      return memory.write(content);
    }
    if (name === "save_birth_details") {
      const candidate = { ...store.birth, ...args };
      if (profileUpdateStatus === 'saved' && sameBirth(candidate, birth)) {
        return {saved: true, profile_saved: true, birth: store.birth};
      }
      if (profileUpdateStatus || !/\b(?:save|add|remember|store|yaad|rakh)\b/i.test(query ?? '')) {
        return {saved: false, profile_saved: false, reason: 'The app profile has not been saved. Resolve the pending confirmation or validation first; do not append a competing birth memory.'};
      }
      if (!sameBirth(candidate, birth) && ![...history.filter(t => t.role === 'user').map(t => t.text), query]
        .some(text => suppliedBirth(candidate, text))) {
        const error = new Error('Birth details need user confirmation');
        error.code = 'birth_details_required';
        throw error;
      }
      await memory.write("[birth] " + JSON.stringify(args));
      store.birth = candidate;
      return { memory_saved: true, profile_saved: profileUpdateStatus === 'saved' && sameBirth(candidate, birth), birth: store.birth };
    }
    if (name === "manage_chat_person_context") {
      store.selectedPerson = args;
      return { ok: true, selected: args };
    }
    if (name === "get_selected_text") {
      return "";
    }
    if (name === "get_browser_context") {
      return { locale: "en-IN", timezone: "Asia/Kolkata" };
    }
    if (!CHART_TOOLS.has(name)) {
      throw new Error("Unknown tool");
    }
    // The app's selected self profile outranks stale model-supplied memory
    // arguments. Keep the boundary outside the unchanged calculation engine.
    args = selectedSelfArguments(name, args, selfBirth);
    if (name === 'get_match_report' && !matchingEvidence(args, {birth, gender, query, history})) {
      const error = new Error('Both people need their own confirmed date, exact time and birthplace');
      error.code = 'matching_birth_required';
      throw error;
    }
    // Dev v2 uses its local Swiss Ephemeris tools by default, without an MCP round trip.
    if (env.VEDASTRO_DIRECT_USE_LOCAL_ENGINE !== "0") {
      const result = await reading(name, args, store.birth, {
        rawSource: env.VEDASTRO_DIRECT_FLOW === "source",
      });
      if (result?.isError) {
        throw new Error("Local reading unavailable");
      }
      return (result.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    }
    if (name === "get_horary_prediction" && !args.horary_number) {
      args = { ...args, horary_number: 100 + Math.floor(Math.random() * 900) };
    }
    try {
      if (!initialized) {
        await rpc({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "astrochat", version: "1.0" },
          },
        });
        initialized = true;
      }
      const result = await rpc({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name, arguments: args },
      });
      if (result.error || !result.result || result.result.isError) {
        throw new Error("Reading tool failed");
      }
      return (result.result.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (name === "get_match_report") {
        const male = await chart(
          convertDate(args.male_birth_date),
          args.male_birth_time,
          args.male_location_name,
          "",
          { env, signal },
        );
        const female = await chart(
          convertDate(args.female_birth_date),
          args.female_birth_time,
          args.female_location_name,
          "",
          { env, signal },
        );
        return {
          male_chart: male,
          female_chart: female,
          compatibility_factors:
            "Compare both charts: 7th house lords, Venus and Moon strength, dasha overlap, and mangal dosha presence.",
        };
      }
      const dob = convertDate(args.birth_date || store.birth?.date);
      const tob = args.birth_time || store.birth?.time;
      const place =
        args.location_name ||
        args.birth_location_name ||
        store.birth?.location_name ||
        store.birth?.place;
      if (!dob || !tob || !place) {
        throw new Error("Birth details incomplete", { cause: error });
      }
      const result = await chart(dob, tob, place, args.query_text || args.question_text || "", {
        env,
        signal,
      });
      if (!result?.summary) {
        throw new Error("Chart unavailable", { cause: error });
      }
      if (name === "get_horary_prediction") {
        result.horary = {
          number_used: args.horary_number,
          note: "Horary number auto-generated; interpretation is chart-based.",
        };
      }
      return result;
    }
  };
}

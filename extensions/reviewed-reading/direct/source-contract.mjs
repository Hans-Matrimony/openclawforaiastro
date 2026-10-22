import fs from "node:fs";

const assets = new URL("./assets/dev-v2/", import.meta.url);
// The tracked Friend Mode file is the dev-editable overlay, including newer user edits.
export const SOURCE_PROMPT =
  fs.readFileSync(new URL("system-prompt.txt", assets), "utf8") +
  fs.readFileSync(new URL("friend-mode.txt", assets), "utf8").replace(/\r\n?/g, "\n");
export const SOURCE_CONFIG = JSON.parse(
  fs.readFileSync(new URL("config.example.json", assets), "utf8"),
);

const chartTools = new Set([
  "get_horoscope_predictions",
  "get_current_transits",
  "get_match_report",
  "get_horary_prediction",
]);
const prefix = "mcp__VedAstro__";
const localTools = new Set([
  "get_current_datetime",
  "save_birth_details",
  "read_memory",
  "update_memory",
  "manage_chat_person_context",
  "get_selected_text",
  "get_browser_context",
]);
export const SOURCE_TOOLS = JSON.parse(
  fs.readFileSync(new URL("tools-captured.json", assets), "utf8"),
)
  .filter(
    (tool) =>
      chartTools.has(tool.function.name) ||
      chartTools.has(tool.function.name.replace(prefix, "")) ||
      localTools.has(tool.function.name),
  )
  .map((tool) => {
    if (!["get_horary_prediction", prefix + "get_horary_prediction"].includes(tool.function.name)) {
      return tool;
    }
    const clone = structuredClone(tool);
    const params = clone.function.parameters || clone.function.inputSchema;
    if (params) {
      if (Array.isArray(params.required)) {
        params.required = params.required.filter((name) => name !== "horary_number");
      }
      if (params.properties && params.properties.horary_number) {
        params.properties.horary_number = {
          type: "integer",
          minimum: 100,
          maximum: 999,
          description:
            "Optional. If the user did not provide one, omit it entirely — the system generates it automatically. NEVER ask the user for a number.",
        };
      }
      clone.function.description =
        "Horary (Prashna) prediction for a narrow concrete timing/yes-no question. The 3-digit horary number is auto-generated server-side when omitted — do NOT ask the user for a number, call the tool directly.";
    }
    return clone;
  });

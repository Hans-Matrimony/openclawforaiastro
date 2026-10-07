import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export function configureMcpRuntime(target, bundled, env = process.env) {
  const key = env.QDRANT_API_KEY,
    address = env.QDRANT_URL;
  if (!key || !address) {
    if (env.ASTROFRIEND_MCP_ENV_CONFIG_REQUIRED === "1") {
      throw new Error("Qdrant runtime environment is required for MCP configuration");
    }
    return "skipped";
  }
  if (typeof key !== "string" || key.length < 24 || /[\r\n]/u.test(key)) {
    throw new Error("Invalid Qdrant runtime environment");
  }
  let url;
  try {
    url = new URL(address);
  } catch {
    throw new Error("Invalid Qdrant runtime address");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid Qdrant runtime address");
  }
  const existing = fs.existsSync(target);
  if (existing && (!fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink())) {
    throw new Error("MCP configuration must be a regular file");
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(existing ? target : bundled, "utf8"));
  } catch {
    throw new Error("MCP configuration cannot be parsed");
  }
  const server = config?.mcpServers?.qdrant;
  if (
    !server ||
    typeof server !== "object" ||
    Array.isArray(server) ||
    (server.env !== undefined &&
      (!server.env || typeof server.env !== "object" || Array.isArray(server.env)))
  ) {
    throw new Error("Qdrant MCP configuration is invalid");
  }
  server.env ??= {};
  server.env.QDRANT_API_KEY = "${QDRANT_API_KEY}";
  server.env.QDRANT_URL = "${QDRANT_URL}";
  const body = JSON.stringify(config, null, 2) + "\n";
  if (existing && fs.readFileSync(target, "utf8") === body) return "unchanged";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.mcporter-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, body, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return existing ? "updated" : "created";
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const app = process.env.OPENCLAW_APP_DIR || "/app";
    const state = process.env.OPENCLAW_STATE_DIR || path.join(app, ".openclaw");
    const status = configureMcpRuntime(
      path.join(state, "config/mcporter.json"),
      path.join(app, "bootstrap-mcporter.json"),
    );
    console.log(`[mcp-runtime] configuration ${status}`);
  } catch {
    console.error(
      "[mcp-runtime] configuration failed; check runtime variables and JSON configuration",
    );
    process.exitCode = 1;
  }
}

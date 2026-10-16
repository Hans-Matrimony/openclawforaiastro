import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NAMES = new Set([
  ...["AGENTS", "SOUL", "TOOLS", "WORKFLOW", "GUARDRAILS", "KUNDLI_RESPONSE"].map(
    (name) => `workspace-astrologer/${name}.md`,
  ),
  ".pi/prompts/astrologer.md",
  "workspace-astrologer-preview/AGENTS.md",
]);
const canonical = (value) => value.replace(/^\uFEFF/u, "").replace(/\r\n/gu, "\n");
const digest = (value) => createHash("sha256").update(canonical(value)).digest("hex");

function safeTarget(root, relative) {
  if (!NAMES.has(relative)) {
    throw new Error("Unknown managed prompt");
  }
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error("Managed prompt symlink rejected");
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  const resolved = path.resolve(current);
  if (path.relative(root, resolved).startsWith("..") || !resolved.startsWith(root + path.sep)) {
    throw new Error("Managed prompt path rejected");
  }
  return resolved;
}

export function loadProfile(bundle, profile) {
  if (!["compact", "legacy"].includes(profile)) {
    throw new Error("Unknown prompt profile");
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(bundle, "manifest.json"), "utf8"));
  if (
    manifest.schema !== "astrofriend-prompt-profiles-v1" ||
    Object.keys(manifest.managed_files ?? {}).length !== NAMES.size
  ) {
    throw new Error("Invalid prompt manifest");
  }
  return Object.entries(manifest.managed_files).map(([relative, entry]) => {
    if (!NAMES.has(relative)) {
      throw new Error("Unknown managed prompt");
    }
    const text = canonical(fs.readFileSync(path.join(bundle, profile, relative), "utf8"));
    if (
      digest(text) !== entry[profile + "_sha256"] ||
      Array.from(text).length !== entry[profile + "_chars"] ||
      (profile === "compact" && text.length > 10000)
    ) {
      throw new Error("Invalid bundled prompt");
    }
    return { relative, entry, text };
  });
}

function atomicWrite(file, text, write = fs.writeFileSync) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.prompt-${process.pid}-${randomBytes(16).toString("hex")}`;
  let descriptor;
  let owned = false;
  try {
    // Exclusive creation cannot follow an existing temporary-file symlink.
    descriptor = fs.openSync(temporary, "wx", 0o600);
    owned = true;
    write(descriptor, text, { encoding: "utf8" });
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
    if (owned && fs.existsSync(temporary)) {
      fs.unlinkSync(temporary);
    }
  }
}

export function installPrompts(bundle, stateDir, profile = "compact", { write } = {}) {
  // Validate every release asset before touching mounted state. Only eight
  // policy files are managed; MEMORY, USER, credentials and sessions are not.
  const files = loadProfile(bundle, profile);
  fs.mkdirSync(stateDir, { recursive: true });
  const root = fs.realpathSync(stateDir);
  const groups = [
    files.filter((f) => !f.relative.startsWith("workspace-astrologer-preview/")),
    files.filter((f) => f.relative.startsWith("workspace-astrologer-preview/")),
  ];
  const result = { profile, updated: 0, unchanged: 0, customized_groups_preserved: 0 };
  for (const group of groups) {
    let prepared;
    try {
      prepared = group.map((f) => {
        const target = safeTarget(root, f.relative);
        const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
        if (
          current !== null &&
          ![
            f.entry.legacy_sha256,
            f.entry.compact_sha256,
            ...(f.entry.previous_stock_sha256 ?? []),
          ].includes(digest(current))
        ) {
          throw new Error("Customized prompt");
        }
        return { ...f, target, current };
      });
    } catch {
      result.customized_groups_preserved++;
      continue; // Keep a customized workspace's entire policy group coherent.
    }
    const changed = prepared.filter((f) => f.current === null || canonical(f.current) !== f.text);
    const applied = [];
    try {
      for (const file of changed) {
        atomicWrite(file.target, file.text, write);
        applied.push(file);
      }
    } catch {
      // Restore exact previous contents if an update fails partway through.
      // Do not start the gateway with a partly replaced policy group.
      let incomplete = false;
      for (const file of applied.toReversed()) {
        try {
          if (file.current === null) {
            fs.unlinkSync(file.target);
          } else {
            atomicWrite(file.target, file.current);
          }
        } catch {
          incomplete = true;
        }
      }
      if (incomplete) {
        throw new Error("Prompt update failed; rollback incomplete, gateway startup stopped");
      }
      throw new Error("Prompt update failed; prior prompts restored");
    }
    result.updated += changed.length;
    result.unchanged += prepared.length - changed.length;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Changing the chat policy requires explicit opt-in, just like the reader.
  const profile = (process.env.ASTROFRIEND_PROMPT_PROFILE || "legacy").trim().toLowerCase();
  const app = process.env.OPENCLAW_APP_DIR || "/app";
  try {
    console.log(
      JSON.stringify(
        installPrompts(
          path.join(app, "astrologer-prompt-profiles"),
          process.env.OPENCLAW_STATE_DIR || path.join(app, ".openclaw"),
          profile,
        ),
      ),
    );
  } catch {
    console.error(
      "Astrologer prompt profile could not be installed safely; gateway startup stopped.",
    );
    process.exitCode = 1;
  }
}

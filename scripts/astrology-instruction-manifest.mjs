import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 512 * 1024;
const FILES = [
  ["AGENTS.md", "workspace-astrologer/AGENTS.md", "instruction-source/AGENTS.md"],
  ["SOUL.md", "workspace-astrologer/SOUL.md", "instruction-source/SOUL.md"],
  ["WORKFLOW.md", "workspace-astrologer/WORKFLOW.md", "workspace-astrologer/WORKFLOW.md"],
  [
    "KUNDLI_RESPONSE.md",
    "workspace-astrologer/KUNDLI_RESPONSE.md",
    "workspace-astrologer/KUNDLI_RESPONSE.md",
  ],
  ["astrologer.md", ".pi/prompts/astrologer.md", ".pi/prompts/astrologer.md"],
];

function fingerprint(root, relative) {
  const file = path.resolve(root, relative);
  let descriptor;
  try {
    const before = fs.lstatSync(file);
    if (!before.isFile() || before.isSymbolicLink() || fs.realpathSync(file) !== file) {
      return { status: "redirected_or_not_regular" };
    }
    if (before.size > MAX_BYTES) {
      return { status: "too_large" };
    }
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev) {
      return { status: "changed" };
    }
    // Bound the read even if the file grows after its initial size check.
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let used = 0;
    while (used < buffer.length) {
      const count = fs.readSync(descriptor, buffer, used, buffer.length - used, used);
      if (!count) {
        break;
      }
      used += count;
    }
    if (used > MAX_BYTES) {
      return { status: "too_large" };
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== used || after.mtimeMs !== opened.mtimeMs || fs.realpathSync(file) !== file) {
      return { status: "changed" };
    }
    const text = buffer
      .subarray(0, used)
      .toString("utf8")
      .replace(/^\uFEFF/u, "")
      .replace(/\r\n/g, "\n");
    return {
      status: "available",
      bytes: used,
      words: text.trim() ? text.trim().split(/\s+/u).length : 0,
      sha256_lf: createHash("sha256").update(text).digest("hex"),
    };
  } catch {
    return { status: "unavailable" };
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
  }
}

export function instructionManifest(config, appDir, stateDir) {
  const agents = config?.agents?.list?.filter((agent) => agent.id === "astrologer_pwa") ?? [];
  const workspace = path.resolve(stateDir, "workspace-astrologer");
  const matched =
    agents.length === 1 &&
    typeof agents[0].workspace === "string" &&
    path.resolve(agents[0].workspace) === workspace;
  const manifest = {
    schema: "astrology-instruction-manifest-v1",
    configured_workspace_matches_expected: matched,
    prompt_text_included: false,
    system_prompt_injection_verified: false,
    files: [],
  };
  if (matched) {
    for (const [file, activePath, bundledPath] of FILES) {
      const active = fingerprint(stateDir, activePath);
      const bundled = fingerprint(path.join(appDir, "bootstrap"), bundledPath);
      manifest.files.push({
        file,
        active,
        bundled,
        matches_bundled:
          active.status === "available" &&
          bundled.status === "available" &&
          active.sha256_lf === bundled.sha256_lf,
      });
    }
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Metadata only, in the existing access-controlled deployment logs. No HTTP
  // surface or model call; customized persona documents remain untouched.
  let manifest;
  try {
    const appDir = process.env.OPENCLAW_APP_DIR || "/app";
    const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(appDir, ".openclaw");
    const config = JSON.parse(
      fs.readFileSync(
        process.env.OPENCLAW_CONFIG_PATH || path.join(appDir, "openclaw.json"),
        "utf8",
      ),
    );
    manifest = instructionManifest(config, appDir, stateDir);
  } catch {
    manifest = {
      schema: "astrology-instruction-manifest-v1",
      status: "unavailable",
      prompt_text_included: false,
    };
  }
  console.log(`[astrology-instruction-manifest] ${JSON.stringify(manifest)}`);
}

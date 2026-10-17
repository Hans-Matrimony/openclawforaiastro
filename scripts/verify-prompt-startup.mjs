// Verify the real image entrypoint against an isolated persistent state volume.
// No gateway, channel, external tool, account or model process is launched.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const docker = process.env.DOCKER_BINARY || "docker";
const image = process.argv[2];
if (!image || image.startsWith("-") || process.argv.length !== 3) {
  throw new Error("Pass one local gateway image name");
}
const job = `prompt-startup-${randomBytes(8).toString("hex")}`;
const volume = `${job}-state`;
let created = false;
let sequence = 0;

function run(args) {
  const result = spawnSync(docker, args, { encoding: "utf8", windowsHide: true, timeout: 60000 });
  // The caller still inspects/removes its owned container on a client timeout.
  if (result.error) {
    return { code: null, output: result.error.message };
  }
  return { code: result.status, output: (result.stdout || "") + (result.stderr || "") };
}
function checked(args) {
  const result = run(args);
  assert.equal(result.code, 0, result.output);
  return result.output;
}
function container(args, command, expectedCode = 0) {
  const name = `${job}-${++sequence}`;
  const result = run([
    "run",
    "--rm",
    "--name",
    name,
    "--label",
    `astrofriend.verification=${job}`,
    "--network",
    "none",
    "--mount",
    `type=volume,source=${volume},target=/state`,
    "--env",
    "OPENCLAW_STATE_DIR=/state",
    ...args,
    image,
    ...command,
  ]);
  // A timeout may leave the disposable container behind: remove it only after
  // confirming its ownership rather than pruning unrelated local resources.
  const remaining = run(["inspect", "--format", "{{json .Config.Labels}}", name]);
  if (remaining.code === 0) {
    assert.equal(JSON.parse(remaining.output.trim())["astrofriend.verification"], job);
    checked(["rm", "-f", name]);
  }
  assert.equal(result.code, expectedCode, result.output);
  return result.output;
}

const privateFiles = [
  "workspace-astrologer/MEMORY.md",
  "workspace-astrologer/USER.md",
  "credentials/synthetic.json",
  "agents/astrologer/sessions/synthetic.jsonl",
];
const seed = `
  const fs = require('node:fs');
  fs.cpSync('/app/astrologer-prompt-profiles/legacy','/state',{recursive:true});
  for (const name of ${JSON.stringify(privateFiles)}) {
    fs.mkdirSync(require('node:path').dirname('/state/'+name),{recursive:true});
    fs.writeFileSync('/state/'+name,'protected synthetic state');
  }
`;
const verify = (profile, custom = false) => `
  (async()=>{
    const fs = require('node:fs'); const assert = require('node:assert/strict');
    const {loadProfile} = await import('/app/install-astrologer-prompts.mjs');
    for (const file of loadProfile('/app/astrologer-prompt-profiles', '${profile}')) {
      const selected = ${custom} && file.relative.startsWith('workspace-astrologer-preview/')
        ? loadProfile('/app/astrologer-prompt-profiles','compact').find(f=>f.relative===file.relative).text : file.text;
      const expected = selected + (${custom} && file.relative === 'workspace-astrologer/SOUL.md' ? '\\nCustom local voice\\n' : '');
      assert.equal(fs.readFileSync('/state/'+file.relative,'utf8').replace(/\\r\\n/g,'\\n'),expected);
    }
    for (const name of ${JSON.stringify(privateFiles)}) assert.equal(fs.readFileSync('/state/'+name,'utf8'),'protected synthetic state');
    const cfg = JSON.parse(fs.readFileSync('/state/openclaw.json','utf8'));
    assert.equal(cfg.plugins.entries['astrology-response'].enabled,false);
    console.log('ACTUAL_STARTUP_STATE_VERIFIED');
  })().catch(e=>{console.error(e.message);process.exitCode=1});
`;

try {
  checked(["image", "inspect", image]); // Use an existing local image, never pull.
  checked(["volume", "create", "--label", `astrofriend.verification=${job}`, volume]);
  created = true;
  container(["--entrypoint", "node"], ["-e", seed]);
  // With no rollout setting, known stock prompts migrate to compact.
  container([], ["node", "-e", verify("compact")]);
  for (const profile of ["compact", "legacy", "compact", "legacy"]) {
    const output = container(
      ["--env", `ASTROFRIEND_PROMPT_PROFILE=${profile}`],
      ["node", "-e", verify(profile)],
    );
    assert(output.includes("ACTUAL_STARTUP_STATE_VERIFIED"));
  }
  container(
    ["--entrypoint", "node"],
    [
      "-e",
      "require('node:fs').appendFileSync('/state/workspace-astrologer/SOUL.md','\\nCustom local voice\\n')",
    ],
  );
  const custom = container(
    ["--env", "ASTROFRIEND_PROMPT_PROFILE=compact"],
    ["node", "-e", verify("legacy", true)],
  );
  assert(custom.includes('"customized_groups_preserved":1'));
  assert(custom.includes("ACTUAL_STARTUP_STATE_VERIFIED"));
  const invalid = container(
    ["--env", "ASTROFRIEND_PROMPT_PROFILE=unknown"],
    ["node", "-e", "require('node:fs').writeFileSync('/state/incorrectly-started','unsafe')"],
    1,
  );
  assert(invalid.includes("gateway startup stopped"));
  container(
    ["--entrypoint", "node"],
    [
      "-e",
      "require('node:assert/strict').equal(require('node:fs').existsSync('/state/incorrectly-started'),false)",
    ],
  );
  console.log(
    JSON.stringify({
      status: "passed",
      actual_image_entrypoint: true,
      persistent_volume: true,
      stock_upgrade_and_legacy_rollback_cycles: 2,
      customized_main_group: "preserved",
      protected_memory_user_credentials_sessions: true,
      invalid_profile: "command never launched",
      external_connections: "network none",
      model_calls: 0,
    }),
  );
} finally {
  if (created) {
    const labels = JSON.parse(
      checked(["volume", "inspect", "--format", "{{json .Labels}}", volume]),
    );
    assert.equal(labels["astrofriend.verification"], job);
    checked(["volume", "rm", volume]);
  }
}

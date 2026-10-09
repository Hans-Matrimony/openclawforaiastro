import assert from "node:assert/strict";
import fs, { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  extractReplyPolicy,
  registerReplyPolicy,
} from "../extensions/reviewed-reading/reply-policy.mjs";
import {
  ASTROLOGY_ASSETS,
  bootstrapAstrologyAssets,
} from "../scripts/bootstrap-astrology-assets.mjs";

const source = readFileSync(new URL("../.pi/prompts/astrologer.md", import.meta.url), "utf8");
const policy = extractReplyPolicy(source);

test("the release plugin registers the policy alongside the authenticated reading route", () => {
  const plugin = readFileSync(
    new URL("../extensions/reviewed-reading/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(plugin, /import.*registerReplyPolicy.*reply-policy\.mjs/);
  assert.match(plugin, /registerReplyPolicy\(api\)/);
  const config = JSON.parse(readFileSync(new URL("../openclaw.json", import.meta.url), "utf8"));
  assert.equal(config.plugins.entries["reviewed-reading"].enabled, true);
  assert.ok(config.plugins.load.paths.includes("/app/extensions/reviewed-reading"));
  assert.ok(ASTROLOGY_ASSETS.includes(".pi/prompts/astrologer.md"));
});

test("the shipped confidence policy fits the loader with editing headroom", () => {
  assert.ok(policy.length <= 7200, `policy is ${policy.length} characters`);
  assert.equal(source.split("**Astrology-only confidence and evidence policy:**").length, 2);
  assert.match(policy, /do not hedge every sentence/);
  assert.match(policy, /conflicting friendship\/engagement instructions/);
  assert.match(policy, /Never suppress a needed clarification just to sound confident/);
  assert.match(policy, /Keep conditional traditional candidates conditional/);
  assert.match(policy, /00:00 and 12:00 are valid times, not presumed placeholders/);
  assert.match(policy, /Do not re-ask a complete usable birth profile/);
});

test("loader boundaries accept 8000 characters but reject larger policies and oversized Unicode sources", () => {
  const prefix =
    "**Astrology-only confidence and evidence policy:**\nFriend behaviour remains unchanged.\n";
  const suffix = "\n**Close-friend tone:**";
  for (const length of [7999, 8000]) {
    const candidate = prefix.padEnd(length, "x");
    assert.equal(extractReplyPolicy(candidate + suffix), candidate);
  }
  assert.throws(
    () => extractReplyPolicy(prefix.padEnd(8001, "x") + suffix),
    /Invalid reply policy/,
  );
  assert.throws(
    () => extractReplyPolicy("अ".repeat(44000) + policy + suffix),
    /Invalid reply policy/,
  );
  assert.throws(() => extractReplyPolicy(policy), /Invalid reply policy/);
  assert.throws(
    () => extractReplyPolicy("**Close-friend tone:**\n" + policy),
    /Invalid reply policy/,
  );
});

test("the environment disable switch is case-insensitive and does not read a policy", () => {
  const previous = process.env.ASTROFRIEND_ASTROLOGY_REPLY_POLICY_ENABLED;
  try {
    for (const value of ["false", " FALSE ", "False"]) {
      process.env.ASTROFRIEND_ASTROLOGY_REPLY_POLICY_ENABLED = value;
      const { hooks, warnings, api } = fixture();
      assert.equal(
        registerReplyPolicy(api, {
          load: () => {
            throw Error("must not read");
          },
        }),
        false,
      );
      assert.deepEqual(hooks, []);
      assert.deepEqual(warnings, []);
    }
  } finally {
    if (previous === undefined) {
      delete process.env.ASTROFRIEND_ASTROLOGY_REPLY_POLICY_ENABLED;
    } else {
      process.env.ASTROFRIEND_ASTROLOGY_REPLY_POLICY_ENABLED = previous;
    }
  }
});

test("confidence cannot be replaced by forced verdicts, invented windows or fixed templates", () => {
  assert.doesNotMatch(source, /even a placement-only packet supports a direct verdict/);
  assert.doesNotMatch(source, /Partner feelings \((?:yes|no)\)/);
  assert.doesNotMatch(source, /Exactly 3 short WhatsApp|hard limit 20 words|55 words per normal/);
  assert.doesNotMatch(source, /never make consecutive readings uniformly positive/);
  assert.match(policy, /A complete answer can end naturally/);
  assert.match(policy, /Never manufacture a positive\/negative verdict/);
  assert.match(policy, /Do not force "Haan\/Nahi", a contact countdown/);
  assert.match(policy, /an event verdict or a timing window/);
  assert.match(policy, /A complete astrology answer ends without a closing question/);
  assert.match(policy, /More birth details do not establish these answers/);
  assert.match(policy, /Use only explicitly supplied, checked relationship themes/);
  assert.match(policy, /never "pakki sambhavna" or an unconditional promise/);
  assert.match(policy, /give one concise limitation sentence and stop/);
  assert.match(
    policy,
    /Do not append placements, partner traits\/background, remedies, questions or another reading/,
  );
});

test("relationship limits remain concise without dismissing supported relationship themes", () => {
  assert.match(policy, /ordinary, kind language, not lectures about free will/);
  assert.match(policy, /Unke baat karne ka waqt aapki kundli se tay nahi hota/);
  assert.match(policy, /Explain missing analysis once in everyday words/);
  assert.match(policy, /Do not dismiss a new-relationship question as private mind-reading/);
  assert.match(policy, /without promising someone will arrive/);
  assert.match(
    policy,
    /A placement-only topic packet supports its supplied traditional themes, not an event verdict or a timing window/,
  );
});

test("confirmed marriage prompts a separation reading without generic counselling or court promises", () => {
  assert.match(policy, /After marriage is confirmed, address the separation reading directly/);
  assert.match(policy, /When status is known, do not ask again/);
  assert.match(policy, /If separation-specific analysis is missing, name that gap once/);
  assert.match(policy, /do not claim astrology never studies separation/);
  assert.match(policy, /An astrological window is not a court finalization date/);
  assert.match(policy, /No assumed suffering, reassurance-only reply or burden question/);
  assert.match(policy, /Past marriage status needs user-confirmed facts, not a DOB-based guess/);
  assert.match(policy, /Explain method challenges without re-asking status/);
  assert.match(policy, /End separation readings without questions or reading offers/);
});

test("release bootstrap and the default loader deliver the real policy without replacing friend files", (t) => {
  const prefix = path.join(os.tmpdir(), "astro-policy-");
  const directory = fs.mkdtempSync(prefix);
  t.after(() => {
    assert.ok(path.resolve(directory).startsWith(path.resolve(prefix)));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const app = path.join(directory, "app");
  const state = path.join(directory, "state");
  for (const relative of ASTROLOGY_ASSETS) {
    const target = path.join(app, "bootstrap", relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, relative === ".pi/prompts/astrologer.md" ? source : "release fixture");
  }
  const preserved = [
    "workspace-astrologer/SOUL.md",
    "workspace-astrologer/AGENTS.md",
    "agents/astrologer/sessions/test.jsonl",
    "cache/kundli.sqlite3",
    "credentials/test",
  ];
  for (const relative of preserved) {
    const target = path.join(state, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "existing synthetic state");
  }
  bootstrapAstrologyAssets(app, state);
  const previousState = process.env.OPENCLAW_STATE_DIR;
  process.env.OPENCLAW_STATE_DIR = state;
  try {
    const { hooks, warnings, api } = fixture();
    assert.equal(registerReplyPolicy(api, { enabled: true }), true);
    assert.deepEqual(warnings, []);
    const delivered = hooks[0][1]({}, { agentId: "astrologer", trigger: "user" });
    assert.deepEqual(delivered, { appendSystemContext: policy });
    for (const relative of preserved) {
      assert.equal(fs.readFileSync(path.join(state, relative), "utf8"), "existing synthetic state");
    }
  } finally {
    if (previousState === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousState;
    }
  }
});

function fixture() {
  const hooks = [],
    warnings = [];
  return {
    hooks,
    warnings,
    api: { on: (...args) => hooks.push(args), logger: { warn: (value) => warnings.push(value) } },
  };
}

test("only the astrology section is delivered, with direct positive and adverse conclusions", () => {
  assert.match(policy, /positive, adverse, delayed, mixed, conditional or unsupported/);
  assert.match(policy, /Strong evaluated support permits "yes, this is likely"/);
  assert.match(policy, /State weak\/adverse support clearly/);
  assert.match(policy, /Lack of evidence is not evidence that an event will never happen/);
  assert.match(policy, /Kindness is tone, not a positive forecast/);
  assert.match(policy, /not inferred distress or a separate comfort bubble/);
  assert.match(policy, /Do not append "what worries you\?" or another generic question/);
  assert.match(policy, /No invented personality, pain or support invitation/);
  assert.match(policy, /Do not append stock lines such as "pakki date nahi hai"/);
  assert.match(policy, /No separate disclaimer bubble/);
  assert.match(policy, /If evidence is actually missing, conflicting or conditional/);
  assert.match(policy, /send only the short question and stop/);
  assert.doesNotMatch(policy, /Close-friend tone:|MODEL 2|Name:|Janam Tithi:/);
});

test("dates, remedies, repeated questions and third-party claims retain evidence boundaries", () => {
  assert.match(policy, /only if event-timing evidence identifies that window/);
  assert.match(policy, /a dasha boundary or supportive placement/);
  assert.match(policy, /Advice and remedies are optional and must not replace the conclusion/);
  assert.match(policy, /Do not create a new date or positive answer/);
  assert.match(
    policy,
    /Earlier assistant prose and remembered predictions are context to check, never chart evidence/,
  );
  assert.match(
    policy,
    /Do not infer another person's love, loyalty, intentions, future contact, name initial or a certain divorce/,
  );
});

test("pinned compatible hook adds context only to the astrologer agent", () => {
  const { hooks, api } = fixture();
  assert.equal(registerReplyPolicy(api, { enabled: true, load: () => policy }), true);
  assert.equal(hooks.length, 1);
  const [name, handler] = hooks[0];
  assert.equal(name, "before_agent_start");
  const event = { prompt: "Meri shaadi kab hogi?", messages: [] };
  assert.deepEqual(handler(event, { agentId: "astrologer" }), { appendSystemContext: policy });
  assert.deepEqual(handler(event, { agentId: "astrologer", trigger: "user" }), {
    appendSystemContext: policy,
  });
  for (const trigger of ["cron", "heartbeat", "memory"]) {
    assert.equal(handler(event, { agentId: "astrologer", trigger }), undefined);
  }
  assert.deepEqual(event, { prompt: "Meri shaadi kab hogi?", messages: [] });
  for (const agentId of ["main", "tarot_reader", "tara", "astrologer-preview", undefined]) {
    assert.equal(handler(event, { agentId }), undefined);
  }
  assert.equal(handler(event, undefined), undefined);
  assert.match(
    policy,
    /never to friend-only conversation, identity, pricing, payment, media delivery or the test-number Tarot flow/,
  );
});

test("disabled rollout performs no filesystem read or prompt change", () => {
  const { hooks, warnings, api } = fixture();
  assert.equal(
    registerReplyPolicy(api, {
      enabled: false,
      load: () => {
        throw Error("must not read");
      },
    }),
    false,
  );
  assert.deepEqual(hooks, []);
  assert.deepEqual(warnings, []);
});

test("hook registration failure does not block the existing plugin registration", () => {
  const { warnings, api } = fixture();
  api.on = () => {
    throw Error("unsupported hook");
  };
  assert.equal(registerReplyPolicy(api, { enabled: true, load: () => policy }), false);
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /unsupported hook/);
});

test("missing, duplicate, oversized or malformed release policy preserves the existing flow", () => {
  for (const load of [
    () => {
      throw Error("private path or token");
    },
    () => "",
    () => source + source,
    () => "x".repeat(128 * 1024 + 1),
    () =>
      "**Astrology-only confidence and evidence policy:**\nFriend behaviour remains unchanged.\n" +
      "x".repeat(8001),
    () => policy.replace("Friend behaviour remains unchanged.", ""),
  ]) {
    const { hooks, warnings, api } = fixture();
    assert.equal(registerReplyPolicy(api, { enabled: true, load }), false);
    assert.deepEqual(hooks, []);
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0], /private path|token/);
  }
  assert.throws(() => extractReplyPolicy(null));
});

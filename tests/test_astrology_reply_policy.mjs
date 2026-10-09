import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractReplyPolicy,
  registerReplyPolicy,
} from "../extensions/reviewed-reading/reply-policy.mjs";

const source = readFileSync(new URL("../.pi/prompts/astrologer.md", import.meta.url), "utf8");
const policy = extractReplyPolicy(source);

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
  assert.match(policy, /Weak or adverse evaluated support/);
  assert.match(policy, /Lack of evidence is not evidence that an event will never happen/);
  assert.match(policy, /Kindness is tone, not a positive forecast/);
  assert.match(policy, /not inferred distress or a separate comfort bubble/);
  assert.match(policy, /Do not append "what worries you\?" or another generic question/);
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

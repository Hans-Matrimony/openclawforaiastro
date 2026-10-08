import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prompt = readFileSync(new URL("../.pi/prompts/astrologer.md", import.meta.url), "utf8");

void test("ordinary reading style is concise without suppressing requested depth or adverse findings", () => {
  assert.match(prompt, /60-90 words in 2-4 flowing sentences/);
  assert.match(prompt, /Preserve adverse findings and necessary birth-time uncertainty/);
  assert.match(prompt, /Explicit requests for detail or multiple answers take precedence/);
  assert.match(prompt, /Keep ordinary friend conversation unchanged/);
});

void test("completed readings do not force advice, closing questions, or extra generation calls", () => {
  assert.match(
    prompt,
    /Do not append routine homework, a service offer, a recap, or a closing question/,
  );
  assert.match(prompt, /Give a remedy or practical action when requested/);
  assert.match(
    prompt,
    /Do not add a separate model call for a verdict, teaser, or cosmetic rewrite/,
  );
});

void test("examples and unsupported tools cannot supply personal predictions", () => {
  assert.match(prompt, /style examples never supply chart facts/);
  assert.match(prompt, /without a working, supported Horary tool/);
  assert.match(prompt, /an explicit language instruction overrides it/);
});

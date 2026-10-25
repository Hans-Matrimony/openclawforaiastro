import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { houseLordConflicts } from "../extensions/reviewed-reading/direct/house-evidence.mjs";

const evidence = JSON.stringify({
  engine: "local-sweph-v2",
  birth_chart: {
    ashtakavarga_house_bindus: { house_11: { sign: "Virgo" } },
  },
});

void test("house lord checks distinguish a period lord from an explicit incorrect house lord", () => {
  assert.deepEqual(
    houseLordConflicts("Mars antardasha. House 11 lord Mercury hai.", [evidence]),
    [],
  );
  assert.deepEqual(houseLordConflicts("house 11 ke lord Mars ki power", [evidence]), [
    { house: 11, expected: "Mercury", claimed: "Mars" },
  ]);
  assert.equal(houseLordConflicts("11th house lord is Mars", [evidence]).length, 1);
  assert.deepEqual(houseLordConflicts("house 11 lord Mars", ["unavailable"]), []);
  assert.deepEqual(
    houseLordConflicts("house 11 lord Mars", [evidence, evidence.replace("Virgo", "Aries")]),
    [],
  );
});

for (const fixed of [true, false]) {
  void test(`source rejects a false house lord with bounded correction: fixed=${fixed}`, async () => {
    let calls = 0;
    const run = directAnswer(
      { user_id: "synthetic", query: "Finances?", language: "english", history: [] },
      {
        env: {
          OPENROUTER_API_KEY: "test",
          VEDASTRO_DIRECT_FLOW: "source",
          VEDASTRO_DIRECT_ENVIRONMENT: "development",
        },
        makeMemory: () => ({ read: async () => [] }),
        makeTools: () => async () => evidence,
        fetchImpl: async (_, options) => {
          const body = JSON.parse(options.body);
          calls++;
          if (calls === 3) {
            assert.match(body.messages.at(-1).content, /Mercury/);
            assert.ok(
              !body.messages.some(
                (m) => m.role === "assistant" && m.content?.includes("lord Mars"),
              ),
            );
          }
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: calls === 1 ? "tool_calls" : "stop",
                  message:
                    calls === 1
                      ? {
                          role: "assistant",
                          content: null,
                          tool_calls: [
                            {
                              id: "chart",
                              type: "function",
                              function: {
                                name: "mcp__VedAstro__get_horoscope_predictions",
                                arguments: "{}",
                              },
                            },
                          ],
                        }
                      : {
                          role: "assistant",
                          content:
                            calls === 3 && fixed
                              ? "House 11 lord Mercury hai.\n\nMixed support."
                              : "House 11 lord Mars hai.\n\nIncome improves.",
                        },
                },
              ],
            }),
          );
        },
      },
    );
    if (fixed) {
      assert.match((await run).reply, /Mercury/);
    } else {
      const reply = (await run).reply;
      assert.doesNotMatch(reply, /lord Mars|Income improves/);
      assert.match(reply, /could not be reconciled with the returned chart evidence/);
    }
    assert.equal(calls, 3);
  });
}

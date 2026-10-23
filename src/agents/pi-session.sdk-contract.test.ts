import { getModel } from "@mariozechner/pi-ai";
import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createAgentSession,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { applySystemPromptOverrideToSession } from "./pi-embedded-runner/system-prompt.js";
import { splitSdkTools } from "./pi-embedded-runner/tool-split.js";

it("retains only explicitly permitted custom tools and preserves prompt/history with the real SDK", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sdk-session-contract-"));
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network"));
  let dispose: (() => void) | undefined;
  try {
    const { builtInTools, customTools } = splitSdkTools({
      sandboxEnabled: true,
      tools: [
        {
          name: "allowed_probe",
          label: "Probe",
          description: "Synthetic permitted tool",
          parameters: Type.Object({}),
          execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
        },
      ],
    });
    const authStorage = AuthStorage.inMemory();
    const { session } = await createAgentSession({
      cwd: directory,
      agentDir: directory,
      authStorage,
      modelRegistry: ModelRegistry.inMemory(authStorage),
      model: getModel("openai", "gpt-4o-mini"),
      tools: [...builtInTools, ...customTools.map((tool) => tool.name)],
      customTools,
      sessionManager: SessionManager.inMemory(directory),
      settingsManager: SettingsManager.inMemory(),
    });
    dispose = () => session.dispose();
    expect(session.getActiveToolNames()).toEqual(["allowed_probe"]);
    applySystemPromptOverrideToSession(session, "Preserved identity and memory instructions");
    expect(session.systemPrompt).toBe("Preserved identity and memory instructions");
    const messages = [{ role: "user" as const, content: "Previous conversation", timestamp: 1 }];
    session.agent.state.messages = messages;
    expect(session.messages).toEqual(messages);
    messages.length = 0;
    expect(session.messages).toHaveLength(1);
    expect(network).not.toHaveBeenCalled();
  } finally {
    dispose?.();
    network.mockRestore();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

import { afterEach, expect, test, vi } from "vitest";
import { resetProcessRegistryForTests } from "./bash-process-registry";
import { createExecTool } from "./bash-tools.exec";
import { createProcessTool } from "./bash-tools.process";

afterEach(() => {
  resetProcessRegistryForTests();
});

test("process send-keys encodes Enter for pty sessions", async () => {
  const execTool = createExecTool();
  const processTool = createProcessTool();
  const result = await execTool.execute("toolcall", {
    command:
      'node -e "const dataEvent=String.fromCharCode(100,97,116,97);process.stdin.on(dataEvent,d=>{process.stdout.write(d);if(d.includes(10)||d.includes(13))process.exit(0);});process.stdout.write(String.fromCharCode(82,69,65,68,89));"',
    pty: true,
    background: true,
  });

  expect(result.details.status).toBe("running");
  const sessionId = result.details.sessionId;
  expect(sessionId).toBeTruthy();

  // Wait until the child has registered stdin before sending Enter. A spawned
  // Windows process is not necessarily ready under parallel test load.
  await vi.waitFor(
    async () => {
      const poll = await processTool.execute("toolcall", { action: "poll", sessionId });
      const details = poll.details as { status?: string; aggregated?: string };
      expect(details.status).toBe("running");
      expect(details.aggregated ?? "").toContain("READY");
    },
    { timeout: 30_000, interval: 50 },
  );

  await processTool.execute("toolcall", {
    action: "send-keys",
    sessionId,
    keys: ["h", "i", "Enter"],
  });

  await vi.waitFor(
    async () => {
      const poll = await processTool.execute("toolcall", { action: "poll", sessionId });
      const details = poll.details as { status?: string; aggregated?: string };
      expect(details.status).toBe("completed");
      expect(details.aggregated ?? "").toContain("hi");
    },
    { timeout: 30_000, interval: 50 },
  );
});

test("process submit sends Enter for pty sessions", async () => {
  const execTool = createExecTool();
  const processTool = createProcessTool();
  const result = await execTool.execute("toolcall", {
    command:
      'node -e "const dataEvent=String.fromCharCode(100,97,116,97);const submitted=String.fromCharCode(115,117,98,109,105,116,116,101,100);process.stdin.on(dataEvent,d=>{if(d.includes(10)||d.includes(13)){process.stdout.write(submitted);process.exit(0);}});process.stdout.write(String.fromCharCode(82,69,65,68,89));"',
    pty: true,
    background: true,
  });

  expect(result.details.status).toBe("running");
  const sessionId = result.details.sessionId;
  expect(sessionId).toBeTruthy();

  // Wait until the child has registered stdin before sending Enter. A spawned
  // Windows process is not necessarily ready under parallel test load.
  await vi.waitFor(
    async () => {
      const poll = await processTool.execute("toolcall", { action: "poll", sessionId });
      const details = poll.details as { status?: string; aggregated?: string };
      expect(details.status).toBe("running");
      expect(details.aggregated ?? "").toContain("READY");
    },
    { timeout: 30_000, interval: 50 },
  );

  await processTool.execute("toolcall", {
    action: "submit",
    sessionId,
  });

  await vi.waitFor(
    async () => {
      const poll = await processTool.execute("toolcall", { action: "poll", sessionId });
      const details = poll.details as { status?: string; aggregated?: string };
      expect(details.status).toBe("completed");
      expect(details.aggregated ?? "").toContain("submitted");
    },
    { timeout: 30_000, interval: 50 },
  );
});

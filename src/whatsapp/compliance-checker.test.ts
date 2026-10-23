import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { check24HourWindow } from "./24-hour-check.js";
import { checkProactiveCompliance, checkReplyCompliance } from "./compliance-checker.js";
import { canMessageUser } from "./opt-in-tracker.js";
import { hasOptedOut } from "./opt-out-handler.js";

vi.mock("./opt-in-tracker.js", () => ({ canMessageUser: vi.fn() }));
vi.mock("./opt-out-handler.js", () => ({ hasOptedOut: vi.fn(), handleOptOut: vi.fn() }));
vi.mock("./24-hour-check.js", () => ({ check24HourWindow: vi.fn(), requiresTemplate: vi.fn() }));

describe("WhatsApp consent and delivery gates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T06:30:00Z"));
    vi.mocked(canMessageUser).mockResolvedValue({ allowed: true });
    vi.mocked(hasOptedOut).mockResolvedValue(false);
    vi.mocked(check24HourWindow).mockResolvedValue({ allowed: true } as Awaited<
      ReturnType<typeof check24HourWindow>
    >);
  });
  afterEach(() => vi.useRealTimers());

  it("allows an opted-in active conversation during daytime", async () => {
    expect((await checkProactiveCompliance("+15550000001")).allowed).toBe(true);
  });
  it("blocks proactive delivery without consent", async () => {
    vi.mocked(canMessageUser).mockResolvedValue({ allowed: false, reason: "No consent" });
    expect((await checkProactiveCompliance("+15550000001")).suggestedAction).toBe("get-opt-in");
  });
  it("blocks opted-out recipients even for replies", async () => {
    vi.mocked(hasOptedOut).mockResolvedValue(true);
    expect((await checkReplyCompliance("+15550000001")).suggestedAction).toBe("stop-messaging");
  });
  it("requires a template outside the active conversation window", async () => {
    vi.mocked(check24HourWindow).mockResolvedValue({
      allowed: false,
      hoursSinceLastMessage: 25,
    } as Awaited<ReturnType<typeof check24HourWindow>>);
    expect((await checkProactiveCompliance("+15550000001")).suggestedAction).toBe("use-template");
  });
  it("blocks proactive delivery during quiet hours", async () => {
    vi.setSystemTime(new Date("2026-10-23T17:00:00Z"));
    expect((await checkProactiveCompliance("+15550000001")).suggestedAction).toBe("wait-for-user");
  });
});

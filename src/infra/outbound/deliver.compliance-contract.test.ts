import { beforeEach, expect, it, vi } from "vitest";
import { deliverOutboundPayloads } from "./deliver.js";

const checks = vi.hoisted(() => ({ proactive: vi.fn(), reply: vi.fn(), log: vi.fn() }));
vi.mock("../../whatsapp/compliance.js", () => ({
  checkProactiveCompliance: checks.proactive,
  checkReplyCompliance: checks.reply,
  logComplianceFailure: checks.log,
}));

beforeEach(() => {
  vi.clearAllMocks();
  checks.proactive.mockResolvedValue({ allowed: false, reason: "Synthetic consent denial" });
  checks.reply.mockResolvedValue({ allowed: false, reason: "Synthetic consent denial" });
});

it.each([false, true])("retains the outbound consent gate (reply=%s)", async (isReplyToUser) => {
  const sendWhatsApp = vi.fn();
  await expect(
    deliverOutboundPayloads({
      cfg: {},
      channel: "whatsapp",
      to: "+19999999999",
      payloads: [{ text: "Synthetic" }],
      isReplyToUser,
      deps: { sendWhatsApp },
    }),
  ).rejects.toThrow("Synthetic consent denial");
  expect(isReplyToUser ? checks.reply : checks.proactive).toHaveBeenCalledOnce();
  expect(isReplyToUser ? checks.proactive : checks.reply).not.toHaveBeenCalled();
  expect(sendWhatsApp).not.toHaveBeenCalled();
});

it("best-effort reporting cannot turn a consent denial into delivery", async () => {
  const sendWhatsApp = vi.fn();
  const onError = vi.fn();
  const results = await deliverOutboundPayloads({
    cfg: {},
    channel: "whatsapp",
    to: "+19999999999",
    payloads: [{ text: "Synthetic" }],
    bestEffort: true,
    onError,
    deps: { sendWhatsApp },
  });
  expect(results).toEqual([]);
  expect(onError).toHaveBeenCalledOnce();
  expect(sendWhatsApp).not.toHaveBeenCalled();
});

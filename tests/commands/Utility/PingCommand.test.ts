import { describe, expect, it, vi } from "vitest";
import { PingCommand } from "@commands/Utility/PingCommand";
import { createMockContext, createMockInteraction } from "../../helpers";

describe("PingCommand lifecycle", () => {
  it("reports non-negative API and response latency values", async () => {
    const interaction = createMockInteraction({
      createdTimestamp: Date.now() + 60_000,
      client: { ws: { ping: 42 } },
    });
    const context = createMockContext();

    await PingCommand.execute(interaction, context);

    expect(
      context.responders.interactionResponder.Reply,
    ).toHaveBeenCalledOnce();
    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledOnce();

    const payload = vi.mocked(context.responders.interactionResponder.Edit)
      .mock.calls[0][1];
    const embed = payload.embeds?.[0] as {
      data?: { fields?: Array<{ name: string; value: string }> };
      fields?: Array<{ name: string; value: string }>;
    };
    const fields = embed?.data?.fields ?? embed?.fields ?? [];
    const values = Object.fromEntries(
      fields.map((field) => [field.name, field.value]),
    );

    expect(values["📡 API Latency"]).toBe("42ms");
    expect(values["⚡ Response Time"]).toMatch(/^\d+ms$/);
    expect(values["⚡ Response Time"]).not.toMatch(/^-/);
    expect(values["✅ Status"]).toBe("Excellent");
  });
});

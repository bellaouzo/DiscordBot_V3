import { describe, expect, it, vi } from "vitest";
import { DebugCommand } from "@commands/Utility/DebugCommand";
import { createMockContext, createMockInteraction } from "../helpers";

describe("DebugCommand lifecycle", () => {
  it("replies with debug embed including uptime and memory", async () => {
    const interaction = createMockInteraction({
      client: { uptime: 125_000 },
    });
    const context = createMockContext();

    await DebugCommand.execute(interaction, context);

    expect(
      context.responders.interactionResponder.Reply,
    ).toHaveBeenCalledOnce();
    const payload = vi.mocked(context.responders.interactionResponder.Reply)
      .mock.calls[0][1];
    const embed = payload.embeds?.[0] as {
      title?: string;
      data?: { title?: string; fields?: Array<{ name: string }> };
      fields?: Array<{ name: string }>;
    };
    const title = embed?.data?.title ?? embed?.title;
    const fields = embed?.data?.fields ?? embed?.fields ?? [];
    const fieldNames = fields.map((field) => field.name).join(" ");

    expect(title).toBe("Bot Debug Information");
    expect(fieldNames).toMatch(/Uptime/);
    expect(fieldNames).toMatch(/Memory Usage/);
  });
});

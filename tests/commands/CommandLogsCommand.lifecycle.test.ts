import { describe, expect, it, vi } from "vitest";
import { CommandLogsCommand } from "@commands/Utility/CommandLogsCommand";
import { createMockContext, createMockInteraction, stubInteractionOptions } from "../helpers";

describe("CommandLogsCommand lifecycle", () => {
  it("edits with invalid end date error", async () => {
    const interaction = createMockInteraction({
      user: { id: "mod-1", tag: "Mod#0001" } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "export",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
      getInteger: () => 50,
      getString: (name: string) => {
        if (name === "end_date") return "bad-date";
        return null;
      },
    });

    const context = createMockContext();
    context.responders.interactionResponder.Defer = vi
      .fn()
      .mockResolvedValue({ success: true });

    await CommandLogsCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Invalid End Date" }),
        ]),
      }),
    );
  });

  it("edits with invalid start date error", async () => {
    const interaction = createMockInteraction({
      user: { id: "mod-1", tag: "Mod#0001" } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "export",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
      getInteger: () => 50,
      getString: (name: string) => {
        if (name === "start_date") return "not-a-date";
        if (name === "end_date") return null;
        if (name === "format") return null;
        return null;
      },
    });

    const context = createMockContext();
    context.responders.interactionResponder.Defer = vi
      .fn()
      .mockResolvedValue({ success: true });

    await CommandLogsCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Invalid Start Date" }),
        ]),
      }),
    );
  });
});

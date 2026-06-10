import { describe, expect, it, vi } from "vitest";
import { SlashCommandBuilder } from "discord.js";
import type { ButtonInteraction } from "discord.js";
import { HelpCommand } from "@commands/Utility/Help/HelpCommand";
import { CreateResponders } from "@responders";
import {
  createMockInteraction,
  createMockContext,
  createMockLogger,
} from "../helpers";

vi.mock("@commands/registry", () => ({
  AllCommands: vi.fn(() => [
    {
      data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Ping the bot"),
      group: "utility",
      execute: vi.fn(),
    },
    {
      data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member"),
      group: "moderation",
      execute: vi.fn(),
    },
  ]),
}));

describe("HelpCommand lifecycle", () => {
  it("routes category button through ComponentRouter to EditReply", async () => {
    const logger = createMockLogger();
    const responders = CreateResponders({ logger });
    const editSpy = vi.spyOn(responders.buttonResponder, "EditReply");

    const interaction = createMockInteraction({
      id: "987654321098765432",
      user: { id: "owner-1", username: "Owner" } as never,
    });

    const context = createMockContext({ responders, logger });

    await HelpCommand.execute(interaction, context);

    let buttonDeferred = false;
    const buttonInteraction = {
      customId: `help:${interaction.id}:select:moderation`,
      user: { id: "owner-1" },
      get deferred() {
        return buttonDeferred;
      },
      replied: false,
      reply: vi.fn(),
      deferUpdate: vi.fn(async () => {
        buttonDeferred = true;
      }),
      editReply: vi.fn().mockResolvedValue(undefined),
    } as unknown as ButtonInteraction;

    const handled =
      await responders.componentRouter.HandleButton(buttonInteraction);

    expect(handled).toBe(true);
    expect(buttonInteraction.deferUpdate).toHaveBeenCalled();
    expect(editSpy).toHaveBeenCalled();
    const payload = editSpy.mock.calls[0]?.[1];
    expect(payload?.content).toContain("Moderation Commands");
    expect(Array.isArray(payload?.embeds)).toBe(true);
  });
});

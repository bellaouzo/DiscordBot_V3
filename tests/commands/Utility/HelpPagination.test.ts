import { describe, expect, it, vi } from "vitest";
import { SlashCommandBuilder } from "discord.js";
import type { ButtonInteraction } from "discord.js";
import { HelpCommand } from "@commands/Utility/Help/HelpCommand";
import { CreateResponders } from "@responders";
import {
  createMockInteraction,
  createMockContext,
  createMockLogger,
} from "../../helpers";
import {
  CreateCategoryPageNavCustomId,
  HELP_SESSION_TIMEOUT_MS,
  ResolveHelpPageIndex,
} from "@commands/Utility/Help/HelpTypes";

vi.mock("@commands/registry", () => ({
  AllCommands: vi.fn(() => [
    {
      data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Ping the bot"),
      group: "utility",
      execute: vi.fn(),
    },
  ]),
}));

describe("Help pagination", () => {
  it("resolves next navigation to the encoded target page", () => {
    expect(ResolveHelpPageIndex("next", 1, 7)).toBe(1);
    expect(ResolveHelpPageIndex("next", 3, 7)).toBe(3);
  });

  it("handles page navigation buttons beyond the first page", async () => {
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
    const pageTwoNext = CreateCategoryPageNavCustomId(
      interaction.id,
      "features",
      "next",
      1,
    );

    const buttonInteraction = {
      customId: pageTwoNext,
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
    expect(editSpy).toHaveBeenCalled();

    const payload = editSpy.mock.calls.at(-1)?.[1];
    expect(payload?.content).toContain("Page 3/");
  });

  it("keeps help sessions alive for fifteen minutes", () => {
    expect(HELP_SESSION_TIMEOUT_MS).toBe(1000 * 60 * 15);
  });
});

import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "discord.js";
import { EconomyCommand } from "@commands/Fun/EconomyCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("EconomyCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with balance embed on balance subcommand success", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      user: { id: "u1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "balance",
      getSubcommandGroup: () => null,
      getUser: () => null,
    });

    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "guild-1",
      balance: 420,
      updated_at: Date.now(),
    });

    const context = createMockContext({ databases });
    await EconomyCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
    expect(databases.userDb.GetBalance).toHaveBeenCalledWith("u1", "guild-1");
  });

  it("replies with insufficient funds when flip bet exceeds balance", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      user: { id: "u1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "flip",
      getSubcommandGroup: () => null,
      getInteger: () => 100,
    });

    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "guild-1",
      balance: 25,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);

    const context = createMockContext({ databases });
    await EconomyCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
    expect(embed.description).toContain("25");
  });
});

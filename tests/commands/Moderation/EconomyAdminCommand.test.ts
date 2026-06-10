import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, GuildMember, User } from "discord.js";
import { EconomyAdminCommand } from "@commands/Moderation/EconomyAdminCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("EconomyAdminCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createModeratorMember(hasBanPermission = true) {
    return {
      roles: {
        cache: {
          some: vi.fn((predicate: (role: { id: string }) => boolean) =>
            predicate({ id: "mod-role-id" }),
          ),
        },
      },
      permissions: {
        has: vi.fn((permission: string) =>
          permission === "BanMembers" ? hasBanPermission : false,
        ),
      },
    };
  }

  it("rejects non-positive addbalance amount", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "addbalance",
      getUser: () => ({ id: "target-1" }),
      getInteger: () => 0,
    });
    const context = createMockContext();
    await EconomyAdminCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Invalid Amount");
  });

  it("adjusts balance on addbalance success", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "addbalance",
      getUser: () => ({ id: "target-1" }),
      getInteger: () => 50,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "target-1",
      guild_id: "guild-1",
      balance: 100,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "target-1",
      guild_id: "guild-1",
      balance: 150,
      updated_at: Date.now(),
    });
    const context = createMockContext({ databases });
    await EconomyAdminCommand.execute(interaction, context);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        guild_id: "guild-1",
        delta: 50,
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });
});

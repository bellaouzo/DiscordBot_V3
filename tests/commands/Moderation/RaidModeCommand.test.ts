import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelType, MessageFlags } from "discord.js";
import type { Guild, GuildMember, User } from "discord.js";
import { RaidModeCommand } from "@commands/Moderation/RaidModeCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("RaidModeCommand behavior", () => {
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

  it("warns when raid mode is already active on on subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "on",
      getInteger: (name: string) =>
        name === "length" ? 10 : name === "slowmode" ? null : null,
      getString: () => "minutes",
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.GetActiveRaidMode).mockReturnValue({
      id: 1,
      guild_id: "guild-1",
      slowmode_seconds: 10,
      expires_at: Date.now() + 600_000,
      applied_by: "mod-1",
    });
    const context = createMockContext({ databases });
    await RaidModeCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Raid Mode Active");
  });

  it("shows active raid mode status on status subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "status",
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.GetActiveRaidMode).mockReturnValue({
      id: 1,
      guild_id: "guild-1",
      slowmode_seconds: 15,
      expires_at: Date.now() + 600_000,
      applied_by: "mod-1",
    });
    const context = createMockContext({ databases });
    await RaidModeCommand.execute(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("🛡️ Raid Mode Status");
  });

  it("activates raid mode and applies slowmode on on subcommand", async () => {
    const setRateLimitPerUser = vi.fn().mockResolvedValue(undefined);
    const textChannel = {
      type: ChannelType.GuildText,
      id: "ch-1",
      manageable: true,
      rateLimitPerUser: 0,
      permissionOverwrites: {
        cache: { values: () => [][Symbol.iterator]() },
        edit: vi.fn().mockResolvedValue(undefined),
      },
      setRateLimitPerUser,
    };
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        channels: {
          cache: {
            filter: vi.fn((predicate: (ch: typeof textChannel) => boolean) => {
              const matched = [textChannel].filter(predicate);
              return {
                values: () => matched[Symbol.iterator](),
              };
            }),
          },
        },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "on",
      getInteger: (name: string) =>
        name === "length" ? 5 : name === "slowmode" ? 10 : null,
      getString: () => "minutes",
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.GetActiveRaidMode).mockReturnValue(null);
    vi.mocked(databases.moderationDb.AddRaidMode).mockReturnValue({
      id: 2,
      guild_id: "guild-1",
      slowmode_seconds: 10,
      expires_at: Date.now() + 300_000,
      applied_by: "mod-1",
    });
    const context = createMockContext({ databases });
    await RaidModeCommand.execute(interaction, context);
    expect(databases.moderationDb.AddRaidMode).toHaveBeenCalled();
    expect(setRateLimitPerUser).toHaveBeenCalledWith(10, "Raid mode enabled");
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
  });
});

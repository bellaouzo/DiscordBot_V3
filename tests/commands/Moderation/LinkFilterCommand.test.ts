import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, GuildMember, User } from "discord.js";
import { LinkFilterCommand } from "@commands/Moderation/LinkFilterCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("LinkFilterCommand behavior", () => {
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

  it("replies when allow pattern is empty", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "allow",
      getString: () => "   ",
    });
    const context = createMockContext();
    await LinkFilterCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Empty Pattern");
  });

  it("adds link filter via moderationDb on allow subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "allow",
      getString: () => "discord.gg",
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.ListLinkFilters).mockReturnValue([]);
    const context = createMockContext({ databases });
    await LinkFilterCommand.execute(interaction, context);
    expect(databases.moderationDb.AddLinkFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        pattern: "discord.gg",
        type: "allow",
        created_by: "mod-1",
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

  it("lists allow and block patterns on list subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.ListLinkFilters).mockReturnValue([
      {
        id: 1,
        guild_id: "guild-1",
        pattern: "discord.gg",
        type: "allow",
        created_by: "mod-1",
        created_at: Date.now(),
      },
      {
        id: 2,
        guild_id: "guild-1",
        pattern: "bit.ly",
        type: "block",
        created_by: "mod-1",
        created_at: Date.now(),
      },
    ]);
    const context = createMockContext({ databases });
    await LinkFilterCommand.execute(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Link Filters"),
          }),
        ]),
      }),
    );
  });
});

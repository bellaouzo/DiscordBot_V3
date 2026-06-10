import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, GuildMember, User } from "discord.js";
import { CasefileCommand } from "@commands/Moderation/CasefileCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("CasefileCommand behavior", () => {
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

  function createCasefileGuild() {
    return {
      id: "guild-1",
      members: {
        cache: { get: vi.fn().mockReturnValue(undefined) },
        fetch: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Guild;
  }

  it("shows empty overview fields when user has no moderation history", async () => {
    const interaction = createMockInteraction({
      guild: createCasefileGuild(),
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([]);
    vi.mocked(databases.userDb.GetNotes).mockReturnValue([]);
    vi.mocked(databases.moderationDb.ListModerationEvents).mockReturnValue([]);
    vi.mocked(databases.moderationDb.ListUserTempActions).mockReturnValue([]);
    vi.mocked(
      databases.moderationDb.GetActiveTempActionForUser,
    ).mockReturnValue(null);
    const context = createMockContext({ databases });
    await CasefileCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Casefile — Target#0001");
    const warningsField = embed.fields.find(
      (field: { name: string }) => field.name === "Warnings",
    );
    expect(warningsField?.value).toBe("None");
  });

  it("replies with casefile overview and registers detail buttons", async () => {
    const interaction = createMockInteraction({
      guild: createCasefileGuild(),
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 1,
        user_id: "target-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "spam",
        created_at: Date.now(),
      },
    ]);
    vi.mocked(databases.userDb.GetNotes).mockReturnValue([]);
    vi.mocked(databases.moderationDb.ListModerationEvents).mockReturnValue([]);
    vi.mocked(databases.moderationDb.ListUserTempActions).mockReturnValue([]);
    vi.mocked(
      databases.moderationDb.GetActiveTempActionForUser,
    ).mockReturnValue(null);
    const context = createMockContext({ databases });
    await CasefileCommand.execute(interaction, context);
    expect(context.responders.componentRouter.RegisterButton).toHaveBeenCalledTimes(
      5,
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });
});

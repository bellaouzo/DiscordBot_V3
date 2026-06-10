import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, GuildMember, User } from "discord.js";
import { TempActionsCommand } from "@commands/Moderation/TempActionsCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
} from "../../helpers";

describe("TempActionsCommand behavior", () => {
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

  it("warns when there are no pending temp actions", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.ListPendingTempActions).mockReturnValue(
      [],
    );
    const context = createMockContext({ databases });
    await TempActionsCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("No Pending Temp Actions");
  });

  it("sends paginated temp actions on success", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.ListPendingTempActions).mockReturnValue([
      {
        id: 1,
        guild_id: "guild-1",
        user_id: "target-1",
        moderator_id: "mod-1",
        action: "mute",
        expires_at: Date.now() + 3600_000,
        reason: "spam",
        created_at: Date.now(),
      },
    ]);
    const context = createMockContext({ databases });
    await TempActionsCommand.execute(interaction, context);
    expect(context.responders.paginatedResponder.Send).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction,
        pages: expect.any(Array),
        flags: MessageFlags.Ephemeral,
        ownerId: "mod-1",
      }),
    );
  });
});

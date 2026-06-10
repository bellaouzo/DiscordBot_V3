import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, GuildMember, User } from "discord.js";
import { BanListCommand } from "@commands/Moderation/BanListCommand";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";

describe("BanListCommand behavior", () => {
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

  it("reports user is not banned on check subcommand", async () => {
    const bans = new Map<string, unknown>();
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        bans: { fetch: vi.fn().mockResolvedValue(bans) },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "check",
      getUser: () => ({ id: "target-1" }),
    });
    const context = createMockContext();
    await BanListCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("User Not Banned");
  });

  it("sends paginated ban list on list subcommand", async () => {
    const banEntry = {
      user: { id: "banned-1", tag: "Banned#0001", username: "Banned" },
      reason: "spam",
    };
    const bans = new Map([["banned-1", banEntry]]);
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        bans: { fetch: vi.fn().mockResolvedValue(bans) },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
    });
    const context = createMockContext();
    await BanListCommand.execute(interaction, context);
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

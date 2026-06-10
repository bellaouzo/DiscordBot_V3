import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, GuildMember, User } from "discord.js";
import { UnbanCommand } from "@commands/Moderation/UnbanCommand";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";

describe("UnbanCommand behavior", () => {
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

  it("replies when user is not banned", async () => {
    const fetchBan = vi.fn().mockRejectedValue(new Error("Unknown Ban"));
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        bans: { fetch: fetchBan },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getString: (name: string) =>
        name === "user" ? "missing-user-id" : "appeal accepted",
    });
    const context = createMockContext();
    await UnbanCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("User Not Banned");
  });

  it("unbans user via WithAction on success", async () => {
    const unban = vi.fn().mockResolvedValue(undefined);
    const bannedUser = {
      user: { id: "banned-id", tag: "Banned#0001" },
    };
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        bans: { fetch: vi.fn().mockResolvedValue(bannedUser) },
        members: { unban },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getString: (name: string) =>
        name === "user" ? "banned-id" : "appeal accepted",
    });
    const context = createMockContext();
    await UnbanCommand.execute(interaction, context);
    expect(context.responders.interactionResponder.WithAction).toHaveBeenCalled();
    expect(unban).toHaveBeenCalledWith("banned-id", "appeal accepted");
  });
});

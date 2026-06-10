import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Guild, GuildMember, TextChannel, User } from "discord.js";
import { PurgeCommand } from "@commands/Moderation/PurgeCommand";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";

describe("PurgeCommand behavior", () => {
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

  it("rejects when both before and after filters are provided", async () => {
    const channel = {
      isTextBased: () => true,
      messages: { fetch: vi.fn() },
      bulkDelete: vi.fn(),
    };
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    (interaction as unknown as { channel: TextChannel }).channel =
      channel as unknown as TextChannel;
    stubInteractionOptions(interaction, {
      getInteger: (name: string) => {
        if (name === "amount") return 5;
        if (name === "before") return 1;
        if (name === "after") return 2;
        return null;
      },
    });
    const context = createMockContext();
    await PurgeCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Invalid Options");
    expect(embed.description).toContain("Cannot use both before and after");
  });

  it("bulk deletes matching messages on success", async () => {
    const bulkDelete = vi.fn().mockResolvedValue([]);
    const message = {
      id: "msg-1",
      author: { id: "author-1" },
      createdTimestamp: Date.now() - 60_000,
    };
    const channel = {
      isTextBased: () => true,
      messages: {
        fetch: vi
          .fn()
          .mockResolvedValue(new Map([["msg-1", message]])),
      },
      bulkDelete,
    };
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    (interaction as unknown as { channel: TextChannel }).channel =
      channel as unknown as TextChannel;
    stubInteractionOptions(interaction, {
      getInteger: (name: string) => (name === "amount" ? 1 : null),
    });
    const context = createMockContext();
    await PurgeCommand.execute(interaction, context);
    expect(context.responders.interactionResponder.WithAction).toHaveBeenCalled();
    expect(bulkDelete).toHaveBeenCalledWith([message], true);
  });
});

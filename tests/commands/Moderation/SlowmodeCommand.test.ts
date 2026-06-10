import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, GuildMember, TextChannel, User } from "discord.js";
import { SlowmodeCommand } from "@commands/Moderation/SlowmodeCommand";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";

describe("SlowmodeCommand behavior", () => {
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

  it("replies with invalid slowmode when seconds exceed maximum", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1", tag: "Mod#0001" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getInteger: () => 99_999,
    });
    const context = createMockContext();
    await SlowmodeCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Invalid Slowmode");
  });

  it("sets channel slowmode on success", async () => {
    const setRateLimitPerUser = vi.fn().mockResolvedValue(undefined);
    const channel = {
      isTextBased: () => true,
      setRateLimitPerUser,
      toString: () => "#general",
    };
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1", tag: "Mod#0001" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    (interaction as unknown as { channel: TextChannel }).channel =
      channel as unknown as TextChannel;
    stubInteractionOptions(interaction, {
      getInteger: () => 30,
      getChannel: () => null,
    });
    const context = createMockContext();
    await SlowmodeCommand.execute(interaction, context);
    expect(setRateLimitPerUser).toHaveBeenCalledWith(30, "Set by Mod#0001");
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });
});

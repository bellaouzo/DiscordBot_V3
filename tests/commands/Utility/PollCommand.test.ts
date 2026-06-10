import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelType, MessageFlags, type Guild, type User } from "discord.js";
import { PollCommand } from "@commands/Utility/PollCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

function createModMember(roleIds: string[] = ["mod-role"]) {
  return {
    roles: {
      cache: {
        some: (fn: (role: { id: string }) => boolean) =>
          roleIds.some((id) => fn({ id })),
      },
    },
    permissions: { has: () => false },
  };
}

function createTextChannelInteraction() {
  const channel = {
    id: "ch-1",
    name: "general",
    type: ChannelType.GuildText,
    send: vi
      .fn()
      .mockResolvedValue({ url: "https://discord.com/channels/1/2/3" }),
    messages: {
      fetch: vi.fn(),
    },
  };
  const interaction = createMockInteraction({
    guild: { id: "guild-1" } as unknown as Guild,
    user: { id: "mod-1" } as unknown as User,
    member: createModMember() as never,
  });
  Object.assign(interaction, { channel });
  return { interaction, channel };
}

function setupModeratorContext() {
  const databases = createMockDatabaseSet();
  vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue({
    guild_id: "guild-1",
    admin_role_ids: [],
    mod_role_ids: ["mod-role"],
    ticket_category_id: null,
    appeal_review_category_id: null,
    command_log_channel_id: null,
    ticket_log_channel_id: null,
    announcement_channel_id: null,
    delete_log_channel_id: null,
    production_log_channel_id: null,
    welcome_channel_id: null,
    roblox_linked_discord_user_id: null,
    roblox_linked_at: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  return createMockContext({ databases });
}

function getEmbedTitle(replyCall: unknown[]): string {
  const payload = replyCall[1] as { embeds: Array<{ title?: string }> };
  return payload.embeds[0]?.title ?? "";
}

describe("PollCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with need more choices when create has fewer than two choices", async () => {
    const { interaction } = createTextChannelInteraction();
    stubInteractionOptions(interaction, {
      getSubcommand: () => "create",
      getString: (name: string) => {
        if (name === "question") return "Favorite color?";
        if (name === "choice_1") return "Blue";
        return null;
      },
      getInteger: () => null,
    });
    const context = setupModeratorContext();
    await PollCommand.execute(interaction, context);

    const replyCall = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(getEmbedTitle(replyCall)).toBe("Need More Choices");
    expect(replyCall[1]).toEqual(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
  });

  it("replies with no polls found when list finds none in channel", async () => {
    const { interaction, channel } = createTextChannelInteraction();
    const emptyPollMessages = { size: 0 };
    vi.mocked(channel.messages.fetch).mockResolvedValue({
      filter: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue(emptyPollMessages),
      }),
    } as never);
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
      getChannel: () => null,
    });
    const context = setupModeratorContext();
    await PollCommand.execute(interaction, context);

    const replyCall = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(getEmbedTitle(replyCall)).toBe("No Polls Found");
    expect(replyCall[1]).toEqual(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
  });

  it("creates poll message on valid create input", async () => {
    const { interaction, channel } = createTextChannelInteraction();
    stubInteractionOptions(interaction, {
      getSubcommand: () => "create",
      getString: (name: string) => {
        if (name === "question") return "Lunch?";
        if (name === "choice_1") return "Pizza";
        if (name === "choice_2") return "Tacos";
        return null;
      },
      getInteger: () => 30,
    });
    const context = setupModeratorContext();
    await PollCommand.execute(interaction, context);

    expect(channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        poll: expect.objectContaining({
          question: { text: "Lunch?" },
        }),
      }),
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Poll created"),
      }),
    );
  });
});

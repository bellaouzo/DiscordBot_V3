import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelType, MessageFlags, TextChannel } from "discord.js";
import type { Guild, User } from "discord.js";
import { HandleCreate } from "@commands/Utility/Giveaway/GiveawayCreateFlow";
import { HandleEnd } from "@commands/Utility/Giveaway/GiveawayEndFlow";
import { HandleReroll } from "@commands/Utility/Giveaway/GiveawayRerollFlow";
import { HandleList } from "@commands/Utility/Giveaway/GiveawayListFlow";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
  captureButtonHandlers,
} from "../../helpers";

vi.mock("@systems/Giveaway/GiveawayEntryHandler", () => ({
  RegisterGiveawayEntryHandler: vi.fn(),
}));

const { RegisterGiveawayEntryHandler } =
  await import("@systems/Giveaway/GiveawayEntryHandler");

function createMember(roleIds: string[] = []) {
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

function createModInteraction(overrides?: {
  channelSend?: ReturnType<typeof vi.fn>;
}) {
  const channelSend =
    overrides?.channelSend ??
    vi.fn().mockResolvedValue({
      id: "giveaway-msg-1",
      url: "https://discord.com/msg/1",
    });
  const channel = {
    id: "ch-1",
    type: ChannelType.GuildText,
    isTextBased: () => true,
    send: channelSend,
  };
  const modMember = createMember(["mod-role"]);
  const interaction = createMockInteraction({
    guild: {
      id: "guild-1",
      channels: { fetch: vi.fn().mockResolvedValue(channel) },
    } as unknown as Guild,
    user: { id: "mod-1" } as unknown as User,
    member: modMember as never,
  });
  Object.assign(interaction, { channel });
  return { interaction, channelSend, channel };
}

function setupModeratorContext() {
  const databases = createMockDatabaseSet();
  vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue({
    guild_id: "guild-1",
    admin_role_ids: [],
    mod_role_ids: ["mod-role"],
    ticket_category_id: null,
    command_log_channel_id: null,
    announcement_channel_id: null,
    delete_log_channel_id: null,
    production_log_channel_id: null,
    welcome_channel_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  vi.mocked(databases.userDb.CreateGiveaway).mockReturnValue({
    id: 1,
    guild_id: "guild-1",
    channel_id: "ch-1",
    message_id: "giveaway-msg-1",
    host_id: "mod-1",
    prize: "Nitro",
    winner_count: 1,
    ends_at: Date.now() + 3_600_000,
    ended: 0,
    created_at: Date.now(),
  });
  return createMockContext({ databases });
}

describe("Giveaway flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("HandleCreate", () => {
    it("replies with permission denied when user is not a moderator", async () => {
      const interaction = createMockInteraction({
        guild: { id: "guild-1" } as unknown as Guild,
        user: { id: "user-1" } as unknown as User,
        member: createMember([]) as never,
      });
      Object.assign(interaction, { channel: { isTextBased: () => true } });
      stubInteractionOptions(interaction, {
        getString: (name: string) =>
          name === "prize" ? "Prize" : name === "duration" ? "1h" : null,
        getInteger: () => 1,
      });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue({
        guild_id: "guild-1",
        admin_role_ids: [],
        mod_role_ids: ["mod-role"],
        ticket_category_id: null,
        command_log_channel_id: null,
        announcement_channel_id: null,
        delete_log_channel_id: null,
        production_log_channel_id: null,
        welcome_channel_id: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      const context = createMockContext({ databases });
      await HandleCreate(interaction, context);
      const embed = (
        context.responders.interactionResponder.Reply as ReturnType<
          typeof vi.fn
        >
      ).mock.calls[0][1].embeds[0];
      expect(embed.data?.title ?? embed.title).toBe("Permission Denied");
    });

    it("replies with invalid duration when duration is out of range", async () => {
      const { interaction } = createModInteraction();
      stubInteractionOptions(interaction, {
        getString: (name: string) =>
          name === "prize" ? "Prize" : name === "duration" ? "bad" : null,
        getInteger: () => 1,
      });
      const context = setupModeratorContext();
      await HandleCreate(interaction, context);
      const embed = (
        context.responders.interactionResponder.Reply as ReturnType<
          typeof vi.fn
        >
      ).mock.calls[0][1].embeds[0];
      expect(embed.data?.title ?? embed.title).toBe("Invalid Duration");
    });

    it("creates giveaway message and registers entry handler on success", async () => {
      const { interaction, channelSend } = createModInteraction();
      stubInteractionOptions(interaction, {
        getString: (name: string) =>
          name === "prize" ? "Nitro" : name === "duration" ? "1h" : null,
        getInteger: () => 1,
      });
      const context = setupModeratorContext();
      captureButtonHandlers(context.responders.componentRouter);
      await HandleCreate(interaction, context);
      expect(channelSend).toHaveBeenCalled();
      expect(context.databases.userDb.CreateGiveaway).toHaveBeenCalled();
      expect(RegisterGiveawayEntryHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          giveawayMessageId: "giveaway-msg-1",
          channel: expect.objectContaining({ id: "ch-1" }),
        }),
      );
      expect(context.responders.interactionResponder.Edit).toHaveBeenCalled();
    });
  });

  describe("HandleEnd", () => {
    it("replies when giveaway is not found", async () => {
      const interaction = createMockInteraction({
        guild: { id: "guild-1" } as unknown as Guild,
        user: { id: "mod-1" } as unknown as User,
      });
      stubInteractionOptions(interaction, {
        getString: () => "missing-msg",
      });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.userDb.GetGiveawayByMessageId).mockReturnValue(null);
      const context = createMockContext({ databases });
      await HandleEnd(interaction, context);
      const embed = (
        context.responders.interactionResponder.Reply as ReturnType<
          typeof vi.fn
        >
      ).mock.calls[0][1].embeds[0];
      expect(embed.data?.title ?? embed.title).toBe("Giveaway Not Found");
    });

    it("ends giveaway when host manages it", async () => {
      const interaction = createMockInteraction({
        guild: {
          id: "guild-1",
          channels: {
            fetch: vi.fn().mockResolvedValue({
              isTextBased: () => true,
              send: vi.fn().mockResolvedValue({}),
              messages: {
                fetch: vi.fn().mockResolvedValue({
                  edit: vi.fn().mockResolvedValue({}),
                  components: [],
                }),
              },
            }),
          },
        } as unknown as Guild,
        user: { id: "host-1" } as unknown as User,
      });
      stubInteractionOptions(interaction, { getString: () => "msg-1" });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.userDb.GetGiveawayByMessageId).mockReturnValue({
        id: 1,
        guild_id: "guild-1",
        channel_id: "ch-1",
        message_id: "msg-1",
        host_id: "host-1",
        prize: "Prize",
        winner_count: 1,
        ends_at: Date.now() + 60_000,
        ended: 0,
        created_at: Date.now(),
      });
      vi.mocked(databases.userDb.GetGiveawayEntries).mockReturnValue(["u1"]);
      vi.mocked(databases.userDb.EndGiveaway).mockReturnValue(true);
      const context = createMockContext({ databases });
      await HandleEnd(interaction, context);
      expect(context.responders.interactionResponder.Defer).toHaveBeenCalled();
      expect(context.responders.interactionResponder.Edit).toHaveBeenCalled();
    });
  });

  describe("HandleReroll", () => {
    it("warns when giveaway has not ended yet", async () => {
      const interaction = createMockInteraction({
        guild: { id: "guild-1" } as unknown as Guild,
        user: { id: "host-1" } as unknown as User,
      });
      stubInteractionOptions(interaction, { getString: () => "msg-1" });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.userDb.GetGiveawayByMessageId).mockReturnValue({
        id: 1,
        guild_id: "guild-1",
        channel_id: "ch-1",
        message_id: "msg-1",
        host_id: "host-1",
        prize: "Prize",
        winner_count: 1,
        ends_at: Date.now() + 60_000,
        ended: 0,
        created_at: Date.now(),
      });
      const context = createMockContext({ databases });
      await HandleReroll(interaction, context);
      const embed = (
        context.responders.interactionResponder.Reply as ReturnType<
          typeof vi.fn
        >
      ).mock.calls[0][1].embeds[0];
      expect(embed.data?.title ?? embed.title).toBe("Not Ended");
    });

    it("rerolls ended giveaway and announces new winners", async () => {
      const channelSend = vi.fn().mockResolvedValue(undefined);
      const textChannel = Object.assign(Object.create(TextChannel.prototype), {
        type: ChannelType.GuildText,
        send: channelSend,
      });
      const interaction = createMockInteraction({
        guild: {
          id: "guild-1",
          channels: {
            fetch: vi.fn().mockResolvedValue(textChannel),
          },
        } as unknown as Guild,
        user: { id: "host-1" } as unknown as User,
        member: createMember(["mod-role"]) as never,
      });
      stubInteractionOptions(interaction, { getString: () => "msg-1" });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.userDb.GetGiveawayByMessageId).mockReturnValue({
        id: 1,
        guild_id: "guild-1",
        channel_id: "ch-1",
        message_id: "msg-1",
        host_id: "host-1",
        prize: "Prize",
        winner_count: 1,
        ends_at: Date.now() - 1000,
        ended: 1,
        created_at: Date.now(),
      });
      vi.mocked(databases.userDb.GetGiveawayEntries).mockReturnValue([
        "u1",
        "u2",
      ]);
      vi.mocked(databases.userDb.EndGiveaway).mockReturnValue(true);
      const context = createMockContext({ databases });
      await HandleReroll(interaction, context);
      expect(channelSend).toHaveBeenCalled();
      expect(
        context.responders.interactionResponder.Reply,
      ).toHaveBeenCalledWith(
        interaction,
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({ title: "Giveaway Rerolled" }),
          ]),
        }),
      );
    });
  });

  describe("HandleList", () => {
    it("replies with no active giveaways warning when list is empty", async () => {
      const interaction = createMockInteraction({
        guild: { id: "guild-1" } as unknown as Guild,
        user: { id: "mod-1" } as unknown as User,
      });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.userDb.GetActiveGiveaways).mockReturnValue([]);
      const context = createMockContext({ databases });
      await HandleList(interaction, context);
      const embed = (
        context.responders.interactionResponder.Reply as ReturnType<
          typeof vi.fn
        >
      ).mock.calls[0][1].embeds[0];
      expect(embed.data?.title ?? embed.title).toBe("No Active Giveaways");
    });

    it("lists active giveaways when present", async () => {
      const interaction = createMockInteraction({
        guild: { id: "guild-1" } as unknown as Guild,
        user: { id: "mod-1" } as unknown as User,
      });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.userDb.GetActiveGiveaways).mockReturnValue([
        {
          id: 2,
          guild_id: "guild-1",
          channel_id: "ch-1",
          message_id: "msg-2",
          host_id: "host-1",
          prize: "Steam Key",
          winner_count: 1,
          ends_at: Date.now() + 120_000,
          ended: 0,
          created_at: Date.now(),
        },
      ]);
      vi.mocked(databases.userDb.GetGiveawayEntryCount).mockReturnValue(3);
      const context = createMockContext({ databases });
      await HandleList(interaction, context);
      expect(
        context.responders.interactionResponder.Reply,
      ).toHaveBeenCalledWith(
        interaction,
        expect.objectContaining({ flags: MessageFlags.Ephemeral }),
      );
    });
  });
});

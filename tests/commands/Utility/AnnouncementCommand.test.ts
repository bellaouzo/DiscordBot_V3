import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelType, type Guild, type User } from "discord.js";
import { AnnouncementCommand } from "@commands/Utility/AnnouncementCommand";
import { PermissionMiddleware } from "@middleware/PermissionMiddleware";
import type { MiddlewareContext } from "@middleware";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  createMockLogger,
  createMockResponderSet,
  stubInteractionOptions,
} from "../../helpers";

function getEmbedTitle(call: unknown[]): string {
  const payload = call[1] as { embeds: Array<{ title?: string }> };
  return payload.embeds[0]?.title ?? "";
}

describe("AnnouncementCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defers, posts to announcement channel, and confirms success for staff", async () => {
    const channelSend = vi.fn().mockResolvedValue({});
    const announcementChannel = {
      id: "announce-ch",
      type: ChannelType.GuildText,
      send: channelSend,
      toString: () => "<#announce-ch>",
    };
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        channels: {
          fetch: vi.fn().mockResolvedValue(announcementChannel),
        },
      } as unknown as Guild,
      user: { id: "admin-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getString: (name: string) => {
        if (name === "message") return "Server maintenance tonight.";
        if (name === "title") return "Maintenance";
        if (name === "mention") return "none";
        if (name === "type") return "maintenance";
        return null;
      },
      getRole: () => null,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: ["mod-role"],
      ticket_category_id: null,
      appeal_review_category_id: null,
      command_log_channel_id: null,
      ticket_log_channel_id: null,
      announcement_channel_id: "announce-ch",
      delete_log_channel_id: null,
      production_log_channel_id: null,
      welcome_channel_id: null,
      roblox_linked_discord_user_id: null,
      roblox_linked_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    const context = createMockContext({ databases });
    await AnnouncementCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Defer).toHaveBeenCalledWith(
      interaction,
      true,
    );
    expect(channelSend).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Maintenance"),
          }),
        ]),
      }),
    );
    const editCall = (
      context.responders.interactionResponder.Edit as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(getEmbedTitle(editCall)).toBe("Announcement Sent");
  });

  it("denies users without configured admin role via permission middleware", async () => {
    const member = {
      roles: {
        cache: {
          some: () => false,
        },
      },
      permissions: { has: () => false },
    };
    const interaction = createMockInteraction({
      guild: { id: "guild-1", ownerId: "owner-1" } as unknown as Guild,
      user: { id: "user-1" } as unknown as User,
      member: member as never,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
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
    const responders = createMockResponderSet();
    const next = vi.fn().mockResolvedValue(undefined);
    const middlewareContext = {
      interaction,
      command: AnnouncementCommand,
      logger: createMockLogger(),
      responders,
      config: AnnouncementCommand.config!,
      databases,
      appConfig: createMockContext().appConfig,
    } as unknown as MiddlewareContext;

    await PermissionMiddleware.execute(middlewareContext, next);

    expect(next).not.toHaveBeenCalled();
    const replyCall = (
      responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(getEmbedTitle(replyCall)).toContain("Missing Admin Role");
  });
});

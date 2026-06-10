import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags, type Guild, type User } from "discord.js";
import { EventCommand } from "@commands/Utility/EventCommand";
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

describe("EventCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates event database row on successful create", async () => {
    const futureTime = Math.floor((Date.now() + 86_400_000) / 1000);
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModMember() as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "create",
      getString: (name: string) =>
        name === "time" ? String(futureTime) : name === "title" ? "Team Meeting" : null,
      getBoolean: () => false,
    });
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
    vi.mocked(databases.serverDb.CreateEvent).mockReturnValue({
      id: 1,
      guild_id: "guild-1",
      guild_event_id: 1,
      title: "Team Meeting",
      scheduled_at: futureTime * 1000,
      should_notify: false,
      created_by: "mod-1",
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    const context = createMockContext({ databases });
    await EventCommand.execute(interaction, context);

    expect(databases.serverDb.CreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        title: "Team Meeting",
        created_by: "mod-1",
      }),
    );
    const replyCall = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(getEmbedTitle(replyCall)).toBe("Event Created");
  });

  it("replies with invalid time when create receives unparseable date", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModMember() as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "create",
      getString: (name: string) =>
        name === "time" ? "not-a-valid-date" : name === "title" ? "Team Meeting" : null,
      getBoolean: () => false,
    });
    const context = setupModeratorContext();
    await EventCommand.execute(interaction, context);

    const replyCall = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(getEmbedTitle(replyCall)).toBe("Invalid Time");
    expect(replyCall[1]).toEqual(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
    expect(context.databases.serverDb.CreateEvent).not.toHaveBeenCalled();
  });
});

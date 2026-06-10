import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags, type Guild, type User } from "discord.js";
import { SetupCommand } from "@commands/Utility/SetupCommand";
import { PermissionMiddleware } from "@middleware/PermissionMiddleware";
import type { MiddlewareContext } from "@middleware";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  createMockLogger,
  createMockResponderSet,
} from "../../helpers";

function createEmptyCollection() {
  const collection = {
    filter: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnValue({
      values: () => [][Symbol.iterator](),
      map: () => [],
    }),
    map: vi.fn().mockReturnValue([]),
  };
  return collection;
}

function createSetupGuild() {
  return {
    id: "guild-1",
    roles: { cache: createEmptyCollection() },
    channels: {
      cache: createEmptyCollection(),
      fetch: vi.fn().mockResolvedValue(null),
    },
  } as unknown as Guild;
}

function getEmbedTitle(replyCall: unknown[]): string {
  const payload = replyCall[1] as { embeds: Array<{ title?: string }> };
  return payload.embeds[0]?.title ?? "";
}

describe("SetupCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens setup wizard embed on success", async () => {
    const interaction = createMockInteraction({
      guild: createSetupGuild(),
      user: { id: "admin-1" } as unknown as User,
    });
    const context = createMockContext();
    await SetupCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Server Setup — Step 1/3",
          }),
        ]),
        components: expect.any(Array),
      }),
    );
    expect(context.responders.selectMenuRouter.RegisterSelectMenu).toHaveBeenCalled();
    expect(context.responders.componentRouter.RegisterButton).toHaveBeenCalled();
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
      command: SetupCommand,
      logger: createMockLogger(),
      responders,
      config: SetupCommand.config!,
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

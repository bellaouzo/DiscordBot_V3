import type { GuildMember } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionMiddleware } from "@middleware/PermissionMiddleware";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  createMockLogger,
  createMockResponderSet,
} from "../../helpers";
import type { MiddlewareContext } from "@middleware";

function createGuildMember(
  roleIds: string[],
  permissions: bigint[] = [],
): GuildMember {
  return {
    roles: {
      cache: {
        some: (fn: (role: { id: string }) => boolean) =>
          roleIds.some((id) => fn({ id })),
      },
    },
    permissions: {
      has: (flag: bigint) => permissions.includes(flag),
    },
  } as unknown as GuildMember;
}

function createMiddlewareContext(overrides?: {
  roleIds?: string[];
  permissions?: bigint[];
  config?: MiddlewareContext["config"];
  guildSettings?: ReturnType<
    ReturnType<typeof createMockDatabaseSet>["serverDb"]["GetGuildSettings"]
  >;
}): MiddlewareContext {
  const member = createGuildMember(
    overrides?.roleIds ?? [],
    overrides?.permissions ?? [],
  );
  const interaction = createMockInteraction({
    guild: { id: "guild-1", name: "Test Guild", ownerId: "owner-1" },
    user: { id: "user-1", username: "TestUser" },
    member,
  });

  const databases = createMockDatabaseSet();
  vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue(
    overrides?.guildSettings ?? {
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: ["mod-role"],
      ticket_category_id: null,
      ticket_log_channel_id: null,
      ticket_panel_channel_id: null,
      appeal_channel_id: null,
      updated_at: Date.now(),
    },
  );

  const context = createMockContext({ databases });

  const command = {
    data: { name: "test", description: "Test" },
    group: "utility",
    execute: vi.fn().mockResolvedValue(undefined),
  };

  return {
    interaction,
    command,
    logger: createMockLogger(),
    responders: createMockResponderSet(),
    config: overrides?.config ?? { adminRole: true },
    databases: context.databases,
    appConfig: context.appConfig,
  } as unknown as MiddlewareContext;
}

describe("PermissionMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next when user has configured admin role", async () => {
    const context = createMiddlewareContext({ roleIds: ["admin-role"] });
    const next = vi.fn().mockResolvedValue(undefined);

    await PermissionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("denies when adminRole required but user lacks configured admin role", async () => {
    const context = createMiddlewareContext({ roleIds: ["other-role"] });
    const next = vi.fn().mockResolvedValue(undefined);

    await PermissionMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Missing Admin Role"),
          }),
        ]),
      }),
    );
  });

  it("calls next when modRole required and user has configured mod role", async () => {
    const context = createMiddlewareContext({
      roleIds: ["mod-role"],
      config: { modRole: true },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await PermissionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next when admin roles are not configured but user has Administrator permission", async () => {
    const context = createMiddlewareContext({
      permissions: [PermissionFlagsBits.Administrator],
      guildSettings: {
        guild_id: "guild-1",
        admin_role_ids: [],
        mod_role_ids: [],
        ticket_category_id: null,
        ticket_log_channel_id: null,
        ticket_panel_channel_id: null,
        appeal_channel_id: null,
        updated_at: Date.now(),
      },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await PermissionMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("denies with setup required when admin roles are not configured and user lacks Administrator permission", async () => {
    const context = createMiddlewareContext({
      guildSettings: {
        guild_id: "guild-1",
        admin_role_ids: [],
        mod_role_ids: [],
        ticket_category_id: null,
        ticket_log_channel_id: null,
        ticket_panel_channel_id: null,
        appeal_channel_id: null,
        updated_at: Date.now(),
      },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await PermissionMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Setup Required"),
          }),
        ]),
      }),
    );
  });
});

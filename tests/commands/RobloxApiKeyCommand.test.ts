import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction, User } from "discord.js";
import * as Utilities from "@utilities";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../helpers";

let RobloxCommand: {
  execute: (
    interaction: ChatInputCommandInteraction,
    context: ReturnType<typeof createMockContext>
  ) => Promise<void>;
};

beforeAll(async () => {
  process.env.ROBLOX_BRIDGE_API_URL = "https://bridge.test";
  process.env.ROBLOX_BRIDGE_API_KEY = "bridge-key";
  process.env.ROBLOX_BRIDGE_URL_SIGNING_SECRET = "test-secret";
  ({ RobloxCommand } = await import("@commands/Moderation/RobloxCommand"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Roblox API Key subcommands", () => {
  it("connect blocks when an API key is already configured", async () => {
    const requestSpy = vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          configured: true,
          guildId: "guild-1",
          keyType: "user",
          targetId: "12345",
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      },
    } as never);

    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as never,
      user: {
        id: "admin-1",
        username: "AdminOne",
        tag: "AdminOne#0001",
      } as unknown as User,
    });
    (interaction as unknown as { memberPermissions: { has: () => boolean } }).memberPermissions =
      {
        has: () => true,
      };
    stubInteractionOptions(interaction, {
      getSubcommand: () => "connect",
    });

    const context = createMockContext();

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledTimes(1);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringMatching(/Already Configured/i),
          }),
        ]),
      })
    );
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/roblox/apikey?guild_id=guild-1"),
      expect.any(Object)
    );
  });

  it("connect returns setup page link button when not configured", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 404,
      error: "Not Found",
    } as never);

    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as never,
      user: {
        id: "admin-1",
        username: "AdminOne",
        tag: "AdminOne#0001",
      } as unknown as User,
    });
    (interaction as unknown as { memberPermissions: { has: () => boolean } }).memberPermissions =
      {
        has: () => true,
      };
    stubInteractionOptions(interaction, {
      getSubcommand: () => "connect",
    });

    const context = createMockContext();

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.any(Array),
        components: [
          expect.objectContaining({
            components: [
              expect.objectContaining({
                url: expect.stringMatching(/expires=\d+&guild_id=guild-1&sig=[a-f0-9]{64}&user_id=admin-1/),
              }),
            ],
          }),
        ],
      })
    );
    // Should NOT register a button handler (no check-status button)
    expect(context.responders.componentRouter.RegisterButton).not.toHaveBeenCalled();
    // Should persist the linked user
    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: "admin-1",
      })
    );
  });

  it("status shows configured info when API key exists", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          configured: true,
          guildId: "guild-1",
          keyType: "user",
          targetId: "12345",
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      },
    } as never);

    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as never,
      user: {
        id: "admin-1",
        username: "AdminOne",
        tag: "AdminOne#0001",
      } as unknown as User,
    });
    (interaction as unknown as { memberPermissions: { has: () => boolean } }).memberPermissions =
      {
        has: () => true,
      };
    stubInteractionOptions(interaction, {
      getSubcommand: () => "status",
    });

    const context = createMockContext();

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledTimes(1);
    // Should NOT clear metadata when configured
    expect(context.databases.serverDb.UpsertGuildSettings).not.toHaveBeenCalled();
  });

  it("status clears stale metadata when API key is not configured", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 404,
      error: "Not Found",
    } as never);

    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as never,
      user: {
        id: "admin-1",
        username: "AdminOne",
        tag: "AdminOne#0001",
      } as unknown as User,
    });
    (interaction as unknown as { memberPermissions: { has: () => boolean } }).memberPermissions =
      {
        has: () => true,
      };
    stubInteractionOptions(interaction, {
      getSubcommand: () => "status",
    });

    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as unknown as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue({
      guild_id: "guild-1",
      roblox_linked_discord_user_id: "admin-2",
      roblox_linked_at: 1700000000000,
    });

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();

    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: null,
        roblox_linked_at: null,
      })
    );
  });

  it("disconnect calls delete endpoint and clears metadata", async () => {
    const requestSpy = vi
      .spyOn(Utilities, "RequestJson")
      // First call: status check - configured
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            configured: true,
            guildId: "guild-1",
            keyType: "user",
            targetId: "12345",
          },
        },
      } as never)
      // Second call: delete
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            deleted: true,
          },
        },
      } as never);

    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as never,
      user: {
        id: "admin-1",
        username: "AdminOne",
        tag: "AdminOne#0001",
      } as unknown as User,
    });
    (interaction as unknown as { memberPermissions: { has: () => boolean } }).memberPermissions =
      {
        has: () => true,
      };
    stubInteractionOptions(interaction, {
      getSubcommand: () => "disconnect",
    });

    const context = createMockContext();

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();

    // Should have called status check and delete
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/roblox/apikey?guild_id=guild-1"),
      expect.objectContaining({ method: "GET" })
    );
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/roblox/apikey?guild_id=guild-1"),
      expect.objectContaining({ method: "DELETE" })
    );
    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: null,
        roblox_linked_at: null,
      })
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledTimes(1);
  });

  it("disconnect returns error when no API key is configured", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: false,
      status: 404,
      error: "Not Found",
    } as never);

    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: { id: "guild-1" } as never,
      user: {
        id: "admin-1",
        username: "AdminOne",
        tag: "AdminOne#0001",
      } as unknown as User,
    });
    (interaction as unknown as { memberPermissions: { has: () => boolean } }).memberPermissions =
      {
        has: () => true,
      };
    stubInteractionOptions(interaction, {
      getSubcommand: () => "disconnect",
    });

    const context = createMockContext();

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();

    expect(context.databases.serverDb.UpsertGuildSettings).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringMatching(/Nothing to Disconnect/i),
          }),
        ]),
      })
    );
  });
});

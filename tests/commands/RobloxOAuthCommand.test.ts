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
  ({ RobloxCommand } = await import("@commands/Moderation/RobloxCommand"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Roblox OAuth subcommands", () => {
  it("connect blocks when a link is already active", async () => {
    const requestSpy = vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          linked: true,
          linkedAt: 1700000000000,
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

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledTimes(1);
    expect(context.responders.componentRouter.RegisterButton).not.toHaveBeenCalled();
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it("connect returns button components and registers status checker", async () => {
    vi.spyOn(Utilities, "RequestJson")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            linked: false,
          },
        },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            authUrl: "https://www.bellaouzo.dev/oauth/start",
            state: "state-token",
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
    (
      context.responders.componentRouter.RegisterButton as unknown as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue({
      customId: "roblox-link-check",
      dispose: vi.fn(),
    });

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.any(Array),
        components: expect.any(Array),
      })
    );
    expect(context.responders.componentRouter.RegisterButton).toHaveBeenCalledTimes(1);
  });

  it("check-status button updates message to linked success", async () => {
    vi.spyOn(Utilities, "RequestJson")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            linked: false,
          },
        },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            authUrl: "https://www.bellaouzo.dev/oauth/start",
            state: "state-token",
          },
        },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            linked: true,
            linkedAt: 1700000000000,
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
    let buttonHandler:
      | ((interactionArg: unknown) => Promise<void>)
      | undefined;
    (
      context.responders.componentRouter.RegisterButton as unknown as ReturnType<
        typeof vi.fn
      >
    ).mockImplementation((options: { handler: (interactionArg: unknown) => Promise<void> }) => {
      buttonHandler = options.handler;
      return {
        customId: "roblox-link-check",
        dispose: vi.fn(),
      };
    });
    (
      context.responders.buttonResponder as unknown as {
        Update: ReturnType<typeof vi.fn>;
      }
    ).Update = vi.fn().mockResolvedValue({
      success: true,
      message: "Button interaction updated",
    });

    await expect(RobloxCommand.execute(interaction, context)).resolves.not.toThrow();
    expect(buttonHandler).toBeDefined();

    const buttonInteraction = {
      user: { id: "admin-1" },
    };
    await expect(buttonHandler!(buttonInteraction)).resolves.not.toThrow();

    expect(
      (context.responders.buttonResponder as unknown as { Update: ReturnType<typeof vi.fn> })
        .Update
    ).toHaveBeenCalledTimes(1);
    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: "admin-1",
        roblox_linked_at: 1700000000000,
      })
    );
  });

  it("status linked=true persists guild link metadata", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          linked: true,
          linkedAt: 1700000000000,
          expiresAt: 1700003600000,
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

    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: "admin-1",
        roblox_linked_at: 1700000000000,
      })
    );
  });

  it("disconnect calls backend unlink endpoint and clears metadata", async () => {
    const requestSpy = vi
      .spyOn(Utilities, "RequestJson")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            linked: true,
            linkedAt: 1700000000000,
          },
        },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          ok: true,
          data: {
            unlinked: true,
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

    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/roblox/link?guild_id=guild-1&user_id=admin-2"
      ),
      expect.objectContaining({
        method: "DELETE",
      })
    );
    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: null,
        roblox_linked_at: null,
      })
    );
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/roblox/link/status"),
      expect.any(Object)
    );
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/roblox/link"),
      expect.objectContaining({ method: "DELETE" })
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledTimes(1);
  });

  it("disconnect returns error when no account is connected", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          linked: false,
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

  it("status clears stale metadata when backend is unlinked", async () => {
    vi.spyOn(Utilities, "RequestJson").mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        data: {
          linked: false,
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
});

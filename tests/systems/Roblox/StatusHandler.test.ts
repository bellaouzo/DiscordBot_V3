import { afterEach, describe, expect, it, vi } from "vitest";
import * as RobloxBridge from "@systems/Roblox/bridge";
import { ExecuteStatusSubcommand } from "@systems/Roblox/handlers/StatusHandler";
import { createMockContext, createMockInteraction } from "../../helpers";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";

const settings: RobloxBridgeSettings = {
  url: "https://bridge.test",
  apiKey: "bridge-key",
  urlSigningSecret: "signing-secret",
  timeoutMs: 5000,
};

function createAdminInteraction() {
  const interaction = createMockInteraction({
    guildId: "guild-1",
    guild: { id: "guild-1" } as never,
  });
  (
    interaction as unknown as { memberPermissions: { has: () => boolean } }
  ).memberPermissions = { has: () => true };
  return interaction;
}

describe("ExecuteStatusSubcommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears stale guild linkage when bridge is not configured", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: false,
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      roblox_linked_discord_user_id: "old-user",
    });

    await ExecuteStatusSubcommand(interaction, context, settings);

    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: null,
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Roblox Not Connected" }),
        ]),
      }),
    );
  });

  it("shows connected status with bridge metadata", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "group",
      targetId: "999",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      roblox_linked_discord_user_id: "admin-1",
    });

    await ExecuteStatusSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Roblox Connected" }),
        ]),
      }),
    );
  });
});

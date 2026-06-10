import { afterEach, describe, expect, it, vi } from "vitest";
import * as RobloxBridge from "@systems/Roblox/bridge";
import { ExecuteConnectSubcommand } from "@systems/Roblox/handlers/ConnectHandler";
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
    user: { id: "admin-1" } as never,
  });
  (
    interaction as unknown as { memberPermissions: { has: () => boolean } }
  ).memberPermissions = { has: () => true };
  return interaction;
}

describe("ExecuteConnectSubcommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks when an API key is already configured", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteConnectSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "API Key Already Configured" }),
        ]),
      }),
    );
  });

  it("returns setup link when not configured", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: false,
    });
    vi.spyOn(RobloxBridge, "BuildApiKeySetupUrl").mockReturnValue(
      "https://bridge.test/setup",
    );

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteConnectSubcommand(interaction, context, settings);

    expect(context.databases.serverDb.UpsertGuildSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        roblox_linked_discord_user_id: "admin-1",
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Connect Roblox API Key" }),
        ]),
        components: expect.any(Array),
      }),
    );
  });
});

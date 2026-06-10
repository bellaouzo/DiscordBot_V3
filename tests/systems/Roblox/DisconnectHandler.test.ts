import { afterEach, describe, expect, it, vi } from "vitest";
import * as RobloxBridge from "@systems/Roblox/bridge";
import { ExecuteDisconnectSubcommand } from "@systems/Roblox/handlers/DisconnectHandler";
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

describe("ExecuteDisconnectSubcommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports when nothing is configured", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: false,
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteDisconnectSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Nothing to Disconnect" }),
        ]),
      }),
    );
  });

  it("disconnects and clears guild settings on success", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
    });
    vi.spyOn(RobloxBridge, "RequestApiKeyDelete").mockResolvedValue(undefined);

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteDisconnectSubcommand(interaction, context, settings);

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
          expect.objectContaining({ title: "Roblox Disconnected" }),
        ]),
      }),
    );
  });

  it("reports delete failures from the bridge", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
    });
    vi.spyOn(RobloxBridge, "RequestApiKeyDelete").mockRejectedValue(
      new Error("Bridge rejected delete"),
    );

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteDisconnectSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Roblox Disconnect Failed" }),
        ]),
      }),
    );
  });
});

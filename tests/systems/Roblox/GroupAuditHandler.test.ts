import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import * as RobloxBridge from "@systems/Roblox/bridge";
import { ExecuteGroupAuditSubcommand } from "@systems/Roblox/handlers/GroupAuditHandler";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";
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
  stubInteractionOptions(interaction, {
    getString: (name: string) => (name === "player" ? "PlayerOne" : null),
  });
  return interaction;
}

describe("ExecuteGroupAuditSubcommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when admin access is denied", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(false);
    const requestStatus = vi.spyOn(RobloxBridge, "RequestApiKeyStatus");

    await ExecuteGroupAuditSubcommand(
      createAdminInteraction(),
      createMockContext(),
      settings,
    );

    expect(requestStatus).not.toHaveBeenCalled();
  });

  it("replies with NOT_CONNECTED when no API key is configured", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: false,
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupAuditSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: expect.stringMatching(/Not Connected/i) }),
        ]),
      }),
    );
  });

  it("replies when API key is not a group key", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "user",
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupAuditSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Group Audit Not Available",
          }),
        ]),
      }),
    );
  });

  it("rejects empty player names", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);

    const interaction = createAdminInteraction();
    stubInteractionOptions(interaction, {
      getString: () => "   ",
    });
    const context = createMockContext();

    await ExecuteGroupAuditSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Invalid Input" }),
        ]),
      }),
    );
  });

  it("maps audit API failures to error embeds", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "group",
    });
    vi.spyOn(RobloxBridge, "RequestGroupAudit").mockRejectedValue(
      Object.assign(new Error("Player missing"), { code: "MEMBER_NOT_FOUND" }),
    );

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupAuditSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Member Not Found" }),
        ]),
      }),
    );
  });

  it("shows success embed with empty audit entries", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "group",
    });
    vi.spyOn(RobloxBridge, "RequestGroupAudit").mockResolvedValue({
      ok: true,
      data: { player: "PlayerOne", entries: [] },
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupAuditSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Group Audit",
            fields: expect.arrayContaining([
              expect.objectContaining({ name: "Entries", value: "0" }),
            ]),
          }),
        ]),
      }),
    );
  });

  it("includes entry previews when audit returns rows", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "group",
    });
    vi.spyOn(RobloxBridge, "RequestGroupAudit").mockResolvedValue({
      ok: true,
      data: {
        player: "PlayerOne",
        entries: Array.from({ length: 6 }, (_, index) => ({
          role: `Role ${index + 1}`,
        })),
      },
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupAuditSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: "Details",
                value: expect.stringContaining("and 1 more"),
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});

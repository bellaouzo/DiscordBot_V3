import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import * as RobloxBridge from "@systems/Roblox/bridge";
import { ExecuteGroupInfoSubcommand } from "@systems/Roblox/handlers/GroupInfoHandler";
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

describe("ExecuteGroupInfoSubcommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replies with NOT_CONNECTED when no API key is configured", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: false,
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupInfoSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringMatching(/Not Connected/i),
          }),
        ]),
      }),
    );
  });

  it("replies when API key is not a group key", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "experience",
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupInfoSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "No Group Key",
          }),
        ]),
      }),
    );
  });

  it("maps API failures to error embeds", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "group",
    });
    vi.spyOn(RobloxBridge, "RequestGroupInfo").mockRejectedValue(
      Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" }),
    );

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupInfoSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: expect.stringMatching(/Failed/i) }),
        ]),
      }),
    );
  });

  it("shows group metadata on success", async () => {
    vi.spyOn(RobloxBridge, "EnsureAdminAccess").mockResolvedValue(true);
    vi.spyOn(RobloxBridge, "RequestApiKeyStatus").mockResolvedValue({
      configured: true,
      keyType: "group",
    });
    vi.spyOn(RobloxBridge, "RequestGroupInfo").mockResolvedValue({
      ok: true,
      data: {
        id: "12345",
        displayName: "Test Group",
        memberCount: 500,
        description: `${"A".repeat(1100)} long description`,
        path: "groups/test",
        publicEntryAllowed: true,
        locked: false,
        verified: true,
        owner: { id: "owner-1" },
        createTime: "2020-01-01",
        updateTime: "2024-01-01",
      },
    });

    const interaction = createAdminInteraction();
    const context = createMockContext();

    await ExecuteGroupInfoSubcommand(interaction, context, settings);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Group Info",
            fields: expect.arrayContaining([
              expect.objectContaining({ name: "Group ID", value: "12345" }),
              expect.objectContaining({ name: "Name", value: "Test Group" }),
              expect.objectContaining({ name: "Members", value: "500" }),
              expect.objectContaining({ name: "Description" }),
              expect.objectContaining({ name: "Path", value: "groups/test" }),
              expect.objectContaining({ name: "Public Entry", value: "Yes" }),
              expect.objectContaining({ name: "Locked", value: "No" }),
              expect.objectContaining({ name: "Verified", value: "Yes" }),
              expect.objectContaining({ name: "Owner ID", value: "owner-1" }),
              expect.objectContaining({ name: "Created", value: "2020-01-01" }),
              expect.objectContaining({ name: "Updated", value: "2024-01-01" }),
            ]),
          }),
        ]),
      }),
    );
  });
});

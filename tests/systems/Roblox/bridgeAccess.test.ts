import { describe, expect, it } from "vitest";
import { MessageFlags } from "discord.js";
import { EnsureAdminAccess } from "@systems/Roblox/bridge";
import { createMockContext, createMockInteraction } from "../../helpers";

describe("EnsureAdminAccess", () => {
  it("allows administrators through", async () => {
    const interaction = createMockInteraction();
    (
      interaction as unknown as { memberPermissions: { has: () => boolean } }
    ).memberPermissions = { has: () => true };

    const context = createMockContext();
    const allowed = await EnsureAdminAccess(interaction, context);

    expect(allowed).toBe(true);
    expect(context.responders.interactionResponder.Reply).not.toHaveBeenCalled();
  });

  it("denies users without administrator permission", async () => {
    const interaction = createMockInteraction();
    (
      interaction as unknown as { memberPermissions: { has: () => boolean } }
    ).memberPermissions = { has: () => false };

    const context = createMockContext();
    const allowed = await EnsureAdminAccess(interaction, context);

    expect(allowed).toBe(false);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Admin Only" }),
        ]),
      }),
    );
  });
});

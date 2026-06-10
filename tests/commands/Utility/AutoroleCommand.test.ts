import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { AutoroleCommand } from "@commands/Utility/AutoroleCommand";
import {
  createMockInteraction,
  createMockContext,
  stubInteractionOptions,
} from "../../helpers";

describe("AutoroleCommand", () => {
  it("sets autorole when role is assignable", async () => {
    const role = { id: "role-1", managed: false, position: 1 };
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: {
        id: "guild-1",
        roles: {
          fetch: vi.fn().mockResolvedValue({
            id: "role-1",
            managed: false,
            position: 1,
          }),
        },
        members: {
          me: {
            roles: { highest: { position: 5 } },
            permissions: { has: () => true },
          },
        },
      } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "set",
      getRole: () => role,
    });

    const upsertGuildSettings = vi.fn();
    const context = createMockContext({
      databases: {
        serverDb: {
          UpsertGuildSettings: upsertGuildSettings,
        },
      } as never,
    });

    await AutoroleCommand.execute(interaction, context);

    expect(upsertGuildSettings).toHaveBeenCalledWith({
      guild_id: "guild-1",
      autorole_id: "role-1",
    });
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
  });

  it("clears autorole", async () => {
    const interaction = createMockInteraction({ guildId: "guild-1" });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "clear",
    });
    const upsertGuildSettings = vi.fn();
    const context = createMockContext({
      databases: {
        serverDb: {
          UpsertGuildSettings: upsertGuildSettings,
        },
      } as never,
    });

    await AutoroleCommand.execute(interaction, context);

    expect(upsertGuildSettings).toHaveBeenCalledWith({
      guild_id: "guild-1",
      autorole_id: null,
    });
  });
});

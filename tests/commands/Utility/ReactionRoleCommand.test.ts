import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { ReactionRoleCommand } from "@commands/Utility/ReactionRoleCommand";
import {
  createMockInteraction,
  createMockContext,
  stubInteractionOptions,
} from "../../helpers";

describe("ReactionRoleCommand", () => {
  it("creates a panel without requiring panel ids", async () => {
    const send = vi.fn().mockResolvedValue({ id: "panel-message-1" });
    const interaction = createMockInteraction({
      guildId: "guild-1",
    });
    Object.assign(interaction, {
      channel: {
        id: "channel-1",
        isTextBased: () => true,
        send,
      },
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "panel",
    });

    const createReactionRolePanel = vi.fn().mockReturnValue({
      id: 3,
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "panel-message-1",
      created_by: "user-1",
      created_at: Date.now(),
    });

    const context = createMockContext({
      databases: {
        serverDb: {
          CreateReactionRolePanel: createReactionRolePanel,
        },
      } as never,
    });

    await ReactionRoleCommand.execute(interaction, context);

    expect(createReactionRolePanel).toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();

    const sentEmbed = send.mock.calls[0][0].embeds?.[0] as {
      description?: string;
    };
    expect(sentEmbed?.description).toContain("No roles configured yet");

    const payload = vi.mocked(context.responders.interactionResponder.Reply)
      .mock.calls[0][1];
    const embed = payload.embeds?.[0] as { description?: string };
    expect(embed?.description).toContain("/reactionrole add emoji:");
    expect(embed?.description).not.toContain("Panel ID");
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
  });

  it("adds mapping using the panel in the current channel", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    const react = vi.fn().mockResolvedValue(undefined);
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
        channels: {
          fetch: vi.fn().mockResolvedValue({
            isTextBased: () => true,
            messages: {
              fetch: vi.fn().mockResolvedValue({ react, edit }),
            },
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
    Object.assign(interaction, {
      channel: { id: "channel-1" },
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "add",
      getString: (name) => {
        if (name === "emoji") {
          return "🎮";
        }
        if (name === "message_id") {
          return null;
        }
        return null;
      },
      getRole: () => ({ id: "role-1", managed: false, position: 1 }),
    });

    const serverDb = {
      ListReactionRolePanelsByChannel: vi.fn().mockReturnValue([
        {
          id: 3,
          guild_id: "guild-1",
          channel_id: "channel-1",
          message_id: "panel-message-1",
        },
      ]),
      GetReactionRoleMappingByPanelAndEmoji: vi.fn().mockReturnValue(null),
      AddReactionRoleMapping: vi.fn(),
      ListReactionRoleMappings: vi.fn().mockReturnValue([
        { emoji: "🎮", role_id: "role-1" },
      ]),
    };
    const context = createMockContext({
      databases: { serverDb } as never,
    });

    await ReactionRoleCommand.execute(interaction, context);

    expect(serverDb.ListReactionRolePanelsByChannel).toHaveBeenCalledWith(
      "guild-1",
      "channel-1",
    );
    expect(serverDb.AddReactionRoleMapping).toHaveBeenCalledWith({
      panel_id: 3,
      emoji: "🎮",
      role_id: "role-1",
    });
    expect(react).toHaveBeenCalledWith("🎮");
    expect(edit).toHaveBeenCalledOnce();

    const editedEmbed = edit.mock.calls[0][0].embeds?.[0] as {
      description?: string;
    };
    expect(editedEmbed?.description).toContain("🎮 — <@&role-1>");
  });

  it("removes mapping by emoji", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    const removeReaction = vi.fn().mockResolvedValue(undefined);
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: {
        id: "guild-1",
        channels: {
          fetch: vi.fn().mockResolvedValue({
            isTextBased: () => true,
            messages: {
              fetch: vi.fn().mockResolvedValue({
                edit,
                reactions: {
                  resolve: () => ({ remove: removeReaction }),
                },
              }),
            },
          }),
        },
      } as never,
    });
    Object.assign(interaction, {
      channel: { id: "channel-1" },
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "remove",
      getString: (name) => (name === "emoji" ? "🎮" : null),
    });

    const serverDb = {
      ListReactionRolePanelsByChannel: vi.fn().mockReturnValue([
        {
          id: 3,
          guild_id: "guild-1",
          channel_id: "channel-1",
          message_id: "panel-message-1",
        },
      ]),
      RemoveReactionRoleMappingByPanelAndEmoji: vi.fn().mockReturnValue({
        id: 1,
        panel_id: 3,
        emoji: "🎮",
        role_id: "role-1",
      }),
      ListReactionRoleMappings: vi.fn().mockReturnValue([]),
    };
    const context = createMockContext({
      databases: { serverDb } as never,
    });

    await ReactionRoleCommand.execute(interaction, context);

    expect(serverDb.RemoveReactionRoleMappingByPanelAndEmoji).toHaveBeenCalledWith(
      3,
      "🎮",
    );
    expect(removeReaction).toHaveBeenCalled();
    expect(edit).toHaveBeenCalledOnce();
  });

  it("omits deleted panels from list results", async () => {
    const interaction = createMockInteraction({
      guildId: "guild-1",
      guild: {
        id: "guild-1",
        channels: {
          fetch: vi
            .fn()
            .mockResolvedValueOnce({
              isTextBased: () => true,
              messages: {
                fetch: vi
                  .fn()
                  .mockRejectedValue(new Error("Unknown Message")),
              },
            })
            .mockResolvedValueOnce({
              isTextBased: () => true,
              messages: {
                fetch: vi.fn().mockResolvedValue({
                  url: "https://discord.com/channels/guild-1/channel-2/msg-2",
                }),
              },
            }),
        },
      } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
    });

    const serverDb = {
      ListReactionRolePanels: vi.fn().mockReturnValue([
        {
          id: 1,
          guild_id: "guild-1",
          channel_id: "channel-1",
          message_id: "deleted-msg",
          created_by: "user-1",
          created_at: Date.now(),
        },
        {
          id: 2,
          guild_id: "guild-1",
          channel_id: "channel-2",
          message_id: "msg-2",
          created_by: "user-1",
          created_at: Date.now(),
        },
      ]),
      ListReactionRoleMappings: vi.fn().mockReturnValue([
        { emoji: "🎮", role_id: "role-1" },
      ]),
      DeleteReactionRolePanel: vi.fn().mockReturnValue(true),
    };
    const context = createMockContext({
      databases: { serverDb } as never,
    });

    await ReactionRoleCommand.execute(interaction, context);

    expect(serverDb.DeleteReactionRolePanel).toHaveBeenCalledWith(1);
    expect(context.responders.paginatedResponder.Send).toHaveBeenCalledOnce();

    const payload = vi.mocked(context.responders.paginatedResponder.Send).mock
      .calls[0][0];
    const embed = payload.pages[0].embeds?.[0] as {
      fields?: Array<{ name: string; value: string }>;
    };

    expect(embed?.fields).toHaveLength(1);
    expect(embed?.fields?.[0].name).toBe("<#channel-2>");
    expect(embed?.fields?.[0].value).toContain("🎮 — <@&role-1>");
  });
});

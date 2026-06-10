import { describe, expect, it, vi } from "vitest";
import {
  BuildReactionRolePanelDescription,
  ListActiveReactionRolePanels,
  ResolveReactionRolePanel,
} from "@systems/ReactionRole/ReactionRolePanelUtils";

function createGuildWithMessage(exists: boolean) {
  return {
    id: "guild-1",
    channels: {
      fetch: vi.fn().mockResolvedValue({
        isTextBased: () => true,
        messages: {
          fetch: exists
            ? vi.fn().mockResolvedValue({ id: "msg-1" })
            : vi.fn().mockRejectedValue(new Error("Unknown Message")),
        },
      }),
    },
  };
}

describe("ReactionRolePanelUtils", () => {
  it("builds panel description with emoji and role mappings", () => {
    const description = BuildReactionRolePanelDescription([
      { emoji: "🎮", role_id: "role-1" },
      { emoji: "notify:123", role_id: "role-2" },
    ]);

    expect(description).toContain("🎮 — <@&role-1>");
    expect(description).toContain("<:notify:123> — <@&role-2>");
  });

  it("resolves the only active panel in a channel", async () => {
    const guild = createGuildWithMessage(true);
    const serverDb = {
      ListReactionRolePanelsByChannel: () => [
        {
          id: 1,
          channel_id: "channel-1",
          message_id: "msg-1",
        },
      ],
      GetReactionRolePanelByMessage: () => null,
      DeleteReactionRolePanel: vi.fn(),
    };

    const result = await ResolveReactionRolePanel(
      guild as never,
      "channel-1",
      null,
      serverDb as never,
      (input) => input,
    );

    expect(result).toEqual({
      panel: {
        id: 1,
        channel_id: "channel-1",
        message_id: "msg-1",
      },
    });
  });

  it("requires message_id when multiple active panels exist in a channel", async () => {
    const guild = createGuildWithMessage(true);
    const serverDb = {
      ListReactionRolePanelsByChannel: () => [
        { id: 1, channel_id: "channel-1", message_id: "msg-1" },
        { id: 2, channel_id: "channel-1", message_id: "msg-2" },
      ],
      GetReactionRolePanelByMessage: () => null,
      DeleteReactionRolePanel: vi.fn(),
    };

    const result = await ResolveReactionRolePanel(
      guild as never,
      "channel-1",
      null,
      serverDb as never,
      (input) => input,
    );

    expect(result).toMatchObject({ title: "Multiple Panels" });
  });

  it("drops deleted panels from list results and prunes the database", async () => {
    const guild = createGuildWithMessage(false);
    const deleteReactionRolePanel = vi.fn().mockReturnValue(true);
    const serverDb = {
      DeleteReactionRolePanel: deleteReactionRolePanel,
    };

    const active = await ListActiveReactionRolePanels(
      guild as never,
      [
        {
          id: 1,
          guild_id: "guild-1",
          channel_id: "channel-1",
          message_id: "deleted-msg",
          created_by: "user-1",
          created_at: Date.now(),
        },
      ],
      serverDb as never,
    );

    expect(active).toEqual([]);
    expect(deleteReactionRolePanel).toHaveBeenCalledWith(1);
  });
});

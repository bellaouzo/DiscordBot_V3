import { describe, expect, it, vi } from "vitest";
import { StarboardManager } from "@systems/Starboard/StarboardManager";
import { createMockLogger } from "../../helpers";

const starboardSettings = {
  starboard_channel_id: "starboard-channel",
  starboard_emoji: "⭐",
  starboard_threshold: 3,
};

function createReactionMessage(starCount: number) {
  const reactions = new Map([
    [
      "⭐",
      {
        emoji: { name: "⭐", id: null },
        count: starCount,
      },
    ],
  ]);

  return {
    partial: false,
    guild: { id: "guild-1" },
    channel: { id: "source-channel" },
    author: { bot: false },
    id: "msg-1",
    reactions: { cache: reactions },
  };
}

describe("StarboardManager", () => {
  it("skips when starboard channel is not configured", async () => {
    const serverDb = {
      GetGuildSettings: vi.fn().mockReturnValue({
        starboard_channel_id: null,
      }),
      GetStarboardEntry: vi.fn(),
    };
    const manager = new StarboardManager(
      { guilds: { cache: new Map() } } as never,
      serverDb as never,
      createMockLogger(),
    );

    await manager.HandleReactionAdd(
      {
        partial: false,
        emoji: { name: "⭐", id: null },
        message: createReactionMessage(3),
      } as never,
      { bot: false } as never,
    );

    expect(serverDb.GetStarboardEntry).not.toHaveBeenCalled();
  });

  it("skips remove when emoji does not match starboard emoji", async () => {
    const serverDb = {
      GetGuildSettings: vi.fn().mockReturnValue(starboardSettings),
      GetStarboardEntry: vi.fn(),
      DeleteStarboardEntry: vi.fn(),
    };
    const manager = new StarboardManager(
      { guilds: { cache: new Map() } } as never,
      serverDb as never,
      createMockLogger(),
    );

    await manager.HandleReactionRemove({
      partial: false,
      emoji: { name: "👍", id: null },
      message: createReactionMessage(2),
    } as never);

    expect(serverDb.GetStarboardEntry).not.toHaveBeenCalled();
    expect(serverDb.DeleteStarboardEntry).not.toHaveBeenCalled();
  });

  it("removes starboard entry when count drops below threshold", async () => {
    const deleteMessage = vi.fn().mockResolvedValue(undefined);
    const serverDb = {
      GetGuildSettings: vi.fn().mockReturnValue(starboardSettings),
      GetStarboardEntry: vi.fn().mockReturnValue({
        guild_id: "guild-1",
        source_message_id: "msg-1",
        starboard_message_id: "starboard-msg-1",
      }),
      DeleteStarboardEntry: vi.fn().mockReturnValue(true),
    };
    const guild = {
      id: "guild-1",
      channels: {
        fetch: vi.fn().mockResolvedValue({
          isTextBased: () => true,
          messages: {
            fetch: vi.fn().mockResolvedValue({ delete: deleteMessage }),
          },
        }),
      },
    };
    const manager = new StarboardManager(
      {
        guilds: {
          cache: new Map([["guild-1", guild]]),
        },
      } as never,
      serverDb as never,
      createMockLogger(),
    );

    await manager.HandleReactionRemove({
      partial: false,
      emoji: { name: "⭐", id: null },
      message: createReactionMessage(2),
    } as never);

    expect(deleteMessage).toHaveBeenCalled();
    expect(serverDb.DeleteStarboardEntry).toHaveBeenCalledWith(
      "guild-1",
      "msg-1",
    );
  });

  it("updates starboard entry when count stays above threshold", async () => {
    const editMessage = vi.fn().mockResolvedValue(undefined);
    const serverDb = {
      GetGuildSettings: vi.fn().mockReturnValue(starboardSettings),
      GetStarboardEntry: vi.fn().mockReturnValue({
        guild_id: "guild-1",
        source_message_id: "msg-1",
        starboard_message_id: "starboard-msg-1",
      }),
      UpdateStarboardEntryCount: vi.fn().mockReturnValue(true),
    };
    const guild = {
      id: "guild-1",
      channels: {
        fetch: vi.fn().mockResolvedValue({
          isTextBased: () => true,
          messages: {
            fetch: vi.fn().mockResolvedValue({
              embeds: [
                {
                  title: "⭐ Starboard",
                  description: "hello",
                  color: 0xf1c40f,
                  url: "https://discord.com/channels/1/2/3",
                },
              ],
              edit: editMessage,
            }),
          },
        }),
      },
    };
    const manager = new StarboardManager(
      {
        guilds: {
          cache: new Map([["guild-1", guild]]),
        },
      } as never,
      serverDb as never,
      createMockLogger(),
    );

    await manager.HandleReactionRemove({
      partial: false,
      emoji: { name: "⭐", id: null },
      message: createReactionMessage(4),
    } as never);

    expect(editMessage).toHaveBeenCalled();
    expect(serverDb.UpdateStarboardEntryCount).toHaveBeenCalledWith(
      "guild-1",
      "msg-1",
      4,
    );
  });
});

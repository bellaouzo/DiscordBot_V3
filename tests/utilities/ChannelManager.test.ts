import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChannelType } from "discord.js";
import { CreateChannelManager } from "@utilities/ChannelManager";
import { createMockLogger } from "../helpers";

function createMockGuild() {
  const channels = new Map<string, unknown>();
  const cache = {
    filter: vi.fn((predicate: (channel: unknown) => boolean) => {
      const matches = [...channels.values()].filter(predicate);
      return {
        size: matches.length,
        first: () => matches[0] ?? null,
      };
    }),
    get: vi.fn((id: string) => channels.get(id) ?? null),
  };

  const guild = {
    id: "guild-1",
    channels: {
      cache,
      create: vi.fn(async (options: { name: string; type: number }) => {
        const channel = {
          id: `channel-${channels.size + 1}`,
          name: options.name,
          type: options.type,
        };
        channels.set(channel.id, channel);
        return channel;
      }),
    },
  };

  return { guild, channels };
}

describe("CreateChannelManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing categories from cache", async () => {
    const { guild } = createMockGuild();
    guild.channels.cache.filter.mockImplementation(
      (predicate: (channel: unknown) => boolean) => {
        const existing = {
          id: "cat-1",
          name: "Appeals",
          type: ChannelType.GuildCategory,
        };
        return predicate(existing)
          ? { size: 1, first: () => existing }
          : { size: 0, first: () => null };
      },
    );

    const manager = CreateChannelManager({
      guild: guild as never,
      logger: createMockLogger(),
    });

    const category = await manager.GetOrCreateCategory("Appeals");

    expect(category).toMatchObject({ id: "cat-1", name: "Appeals" });
    expect(guild.channels.create).not.toHaveBeenCalled();
  });

  it("creates a text channel under a fallback category", async () => {
    const { guild } = createMockGuild();
    guild.channels.cache.filter.mockReturnValue({
      size: 0,
      first: () => null,
    });

    const manager = CreateChannelManager({
      guild: guild as never,
      logger: createMockLogger(),
    });

    const channel = await manager.GetOrCreateTextChannel(
      "command-logs",
      "Logging",
    );

    expect(guild.channels.create).toHaveBeenCalledTimes(2);
    expect(channel).toMatchObject({
      name: "command-logs",
      type: ChannelType.GuildText,
    });
  });

  it("logs and returns null when category creation fails", async () => {
    const { guild } = createMockGuild();
    guild.channels.cache.filter.mockReturnValue({
      size: 0,
      first: () => null,
    });
    guild.channels.create.mockRejectedValue(new Error("Missing permissions"));

    const logger = createMockLogger();
    const manager = CreateChannelManager({
      guild: guild as never,
      logger,
    });

    const category = await manager.GetOrCreateCategory("Appeals");

    expect(category).toBeNull();
    expect(logger.Error).toHaveBeenCalledWith(
      "Failed to create category",
      expect.objectContaining({
        extra: expect.objectContaining({ categoryName: "Appeals" }),
      }),
    );
  });
});

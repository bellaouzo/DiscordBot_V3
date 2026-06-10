import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationCommandOptionType } from "discord.js";
import { createMockLogger } from "../helpers";

const getOrCreateTextChannelMock = vi.fn();
const channelSendMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@utilities/ChannelManager", () => ({
  CreateChannelManager: vi.fn(() => ({
    GetOrCreateTextChannel: getOrCreateTextChannelMock,
  })),
}));

import { CreateDiscordLogger } from "@utilities/DiscordLogger";

describe("CreateDiscordLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrCreateTextChannelMock.mockResolvedValue({
      send: channelSendMock,
    });
  });

  it("warns when the logging channel cannot be created", async () => {
    getOrCreateTextChannelMock.mockResolvedValue(null);
    const logger = createMockLogger();
    const guild = { id: "guild-1" } as never;

    const discordLogger = CreateDiscordLogger({
      guild,
      logger,
      config: {
        commandLogChannelName: "command-logs",
        commandLogCategoryName: "logging",
      },
    });

    await discordLogger.LogCommandExecution(
      {
        user: { id: "user-1", toString: () => "<@user-1>" },
        channel: { toString: () => "#general" },
        options: { data: [] },
        guildId: "guild-1",
      } as never,
      {
        data: { name: "ping" },
        group: "Utility",
      } as never,
    );

    expect(logger.Warn).toHaveBeenCalledWith(
      "Failed to get or create logging channel",
      expect.objectContaining({
        extra: expect.objectContaining({
          guildId: "guild-1",
          channelName: "command-logs",
        }),
      }),
    );
    expect(channelSendMock).not.toHaveBeenCalled();
  });

  it("logs top-level slash options without a subcommand", async () => {
    const logger = createMockLogger();
    const guild = { id: "guild-1" } as never;

    const discordLogger = CreateDiscordLogger({
      guild,
      logger,
      config: {
        commandLogChannelName: "command-logs",
        commandLogCategoryName: "logging",
      },
    });

    await discordLogger.LogCommandExecution(
      {
        user: { id: "user-1", toString: () => "<@user-1>" },
        channel: { toString: () => "#general" },
        options: {
          data: [{ name: "reason", value: "test", type: 3 }],
        },
        guildId: "guild-1",
      } as never,
      {
        data: { name: "warn" },
        group: "Moderation",
      } as never,
    );

    const payload = channelSendMock.mock.calls[0][0];
    const fieldNames = payload.embeds[0].data.fields.map(
      (field: { name: string }) => field.name,
    );
    expect(fieldNames).toContain("Arguments");
    expect(fieldNames).not.toContain("Subcommand");
  });

  it("sends an embed with subcommand fields when logging succeeds", async () => {
    const logger = createMockLogger();
    const guild = { id: "guild-1" } as never;

    const discordLogger = CreateDiscordLogger({
      guild,
      logger,
      config: {
        commandLogChannelName: "command-logs",
        commandLogCategoryName: "logging",
      },
    });

    await discordLogger.LogCommandExecution(
      {
        user: { id: "user-1", toString: () => "<@user-1>" },
        channel: { toString: () => "#general" },
        options: {
          data: [
            {
              type: ApplicationCommandOptionType.Subcommand,
              name: "list",
              options: [{ name: "page", value: 2 }],
            },
          ],
        },
        guildId: "guild-1",
      } as never,
      {
        data: { name: "help" },
        group: "Utility",
      } as never,
    );

    expect(channelSendMock).toHaveBeenCalledOnce();
    const payload = channelSendMock.mock.calls[0][0];
    const embed = payload.embeds[0];
    const fieldNames = embed.data.fields.map(
      (field: { name: string }) => field.name,
    );

    expect(fieldNames).toContain("Subcommand");
    expect(fieldNames).toContain("Arguments");
  });
});

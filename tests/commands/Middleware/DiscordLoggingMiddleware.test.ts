import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockContext,
  createMockInteraction,
  createMockLogger,
  createMockResponderSet,
} from "../../helpers";
import type { MiddlewareContext } from "@middleware";

const logCommandExecutionMock = vi.fn().mockResolvedValue(undefined);
const createDiscordLoggerMock = vi.fn(() => ({
  LogCommandExecution: logCommandExecutionMock,
}));
const appendCommandLogMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@utilities/DiscordLogger", () => ({
  CreateDiscordLogger: (...args: unknown[]) => createDiscordLoggerMock(...args),
}));

vi.mock("@utilities/CommandLogStore", () => ({
  AppendCommandLog: (...args: unknown[]) => appendCommandLogMock(...args),
}));

import { DiscordLoggingMiddleware } from "@middleware/DiscordLoggingMiddleware";

function createMiddlewareContext(overrides: {
  guild?: { id: string } | null;
  guildId?: string | null;
  commandLogChannelId?: string | null;
}): MiddlewareContext {
  const guild = overrides.guild === undefined
    ? { id: "guild-1" }
    : overrides.guild;
  const interaction = createMockInteraction({
    guild,
    guildId: overrides.guildId ?? guild?.id ?? null,
    user: { id: "user-1", username: "TestUser" },
  });
  const context = createMockContext();
  if (overrides.commandLogChannelId !== undefined) {
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      command_log_channel_id: overrides.commandLogChannelId,
    });
  }
  const command = {
    data: { name: "ping", description: "Test" },
    group: "utility",
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return {
    interaction,
    command,
    logger: createMockLogger(),
    responders: createMockResponderSet(),
    config: {},
    databases: context.databases,
    appConfig: context.appConfig,
  } as unknown as MiddlewareContext;
}

describe("DiscordLoggingMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has name discord-logging", () => {
    expect(DiscordLoggingMiddleware.name).toBe("discord-logging");
  });

  it("does not log when interaction has no guild", async () => {
    const context = createMiddlewareContext({ guild: null, guildId: null });
    const next = vi.fn().mockResolvedValue(undefined);

    await DiscordLoggingMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(createDiscordLoggerMock).not.toHaveBeenCalled();
    expect(appendCommandLogMock).not.toHaveBeenCalled();
  });

  it("creates a logger for the interaction guild each time", async () => {
    const first = createMiddlewareContext({
      guild: { id: "guild-a" },
      commandLogChannelId: "log-a",
    });
    const second = createMiddlewareContext({
      guild: { id: "guild-b" },
      commandLogChannelId: "log-b",
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await DiscordLoggingMiddleware.execute(first, next);
    await DiscordLoggingMiddleware.execute(second, next);

    expect(createDiscordLoggerMock).toHaveBeenCalledTimes(2);
    expect(createDiscordLoggerMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        guild: expect.objectContaining({ id: "guild-a" }),
        commandLogChannelId: "log-a",
      }),
    );
    expect(createDiscordLoggerMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        guild: expect.objectContaining({ id: "guild-b" }),
        commandLogChannelId: "log-b",
      }),
    );
    expect(logCommandExecutionMock).toHaveBeenCalledTimes(2);
    expect(appendCommandLogMock).toHaveBeenCalledTimes(2);
  });
});

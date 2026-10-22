import { describe, it, expect, vi } from "vitest";
import {
  BuildMiddlewareChain,
  CreateCommandExecutor,
} from "@bot/ExecuteCommand";
import {
  AutoMiddleware,
  ErrorMiddleware,
  LoggingMiddleware,
} from "@middleware";
import type { CommandMiddleware } from "@middleware";
import type { CommandDefinition } from "@commands";
import {
  createMockContext,
  createMockInteraction,
  createMockLogger,
  createMockResponderSet,
} from "../helpers";

function CreateTestCommand(
  overrides: Partial<CommandDefinition> = {},
): CommandDefinition {
  return {
    data: { name: "test", description: "Test" } as CommandDefinition["data"],
    group: "utility",
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("BuildMiddlewareChain", () => {
  it("wraps the command's middleware in the global middleware, error handler first", () => {
    const command = CreateTestCommand({
      config: {
        guildOnly: true,
        cooldown: { seconds: 3 },
        botPermissions: { required: ["BanMembers"] },
        autoDefer: { ephemeral: false },
      },
      middleware: AutoMiddleware({
        guildOnly: true,
        cooldown: { seconds: 3 },
        botPermissions: { required: ["BanMembers"] },
        autoDefer: { ephemeral: false },
      }),
    });

    expect(BuildMiddlewareChain(command).map((m) => m.name)).toEqual([
      "error-handler",
      "blocklist",
      "logging",
      "command-enabled",
      "channel-restriction",
      "guild-only",
      "bot-permissions",
      "cooldown",
      "auto-defer",
      "discord-logging",
    ]);
  });

  it("does not duplicate global middleware a command lists itself", () => {
    const command = CreateTestCommand({
      middleware: { before: [LoggingMiddleware], after: [ErrorMiddleware] },
    });

    const names = BuildMiddlewareChain(command).map((m) => m.name);

    expect(names.filter((name) => name === "logging")).toHaveLength(1);
    expect(names.filter((name) => name === "error-handler")).toHaveLength(1);
  });
});

describe("CreateCommandExecutor", () => {
  it("answers errors thrown by middleware before the handler", async () => {
    const failing: CommandMiddleware = {
      name: "failing",
      execute: async () => {
        throw new Error("db down");
      },
    };
    const command = CreateTestCommand({ middleware: { before: [failing] } });
    const mockContext = createMockContext();
    const responders = createMockResponderSet();
    const executor = CreateCommandExecutor({
      databases: mockContext.databases,
      appConfig: mockContext.appConfig,
    });

    await expect(
      executor(
        command,
        createMockInteraction({ user: { id: "user-1" } }),
        responders,
        createMockLogger(),
      ),
    ).resolves.toBeUndefined();

    expect(command.execute).not.toHaveBeenCalled();
    expect(responders.interactionResponder.Reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: "Command Failed" })],
      }),
    );
  });

  it("runs the handler when nothing blocks it", async () => {
    const command = CreateTestCommand();
    const mockContext = createMockContext();
    const executor = CreateCommandExecutor({
      databases: mockContext.databases,
      appConfig: mockContext.appConfig,
    });

    await executor(
      command,
      createMockInteraction({ user: { id: "user-1" } }),
      createMockResponderSet(),
      createMockLogger(),
    );

    expect(command.execute).toHaveBeenCalledOnce();
  });
});

import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CooldownMiddleware,
  RecordCooldown,
  ResetCooldownsForTesting,
  ResolveCooldownMs,
} from "@middleware/CooldownMiddleware";
import {
  ConfigureCooldownPersistence,
  ResetCooldownStoreForTesting,
} from "@middleware/CooldownState";
import { ServerDatabase } from "@database/ServerDatabase";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import { CreateCommandExecutor } from "@bot/ExecuteCommand";
import { RunMiddlewareChain } from "@middleware";
import {
  createMockInteraction,
  createMockContext,
  createMockLogger,
  createMockResponderSet,
} from "../../helpers";
import type { MiddlewareContext } from "@middleware";
import type { CommandDefinition } from "@commands";

function createMiddlewareContext(overrides?: {
  cooldownSeconds?: number;
}): MiddlewareContext {
  const interaction = createMockInteraction({
    user: { id: "user-1", username: "TestUser" },
  });
  const context = createMockContext();
  const command = {
    data: { name: "test", description: "Test" },
    group: "utility",
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return {
    interaction,
    command,
    logger: createMockLogger(),
    responders: createMockResponderSet(),
    config: {
      cooldown: { seconds: overrides?.cooldownSeconds ?? 30 },
    },
    databases: context.databases,
    appConfig: context.appConfig,
  } as unknown as MiddlewareContext;
}

describe("ResolveCooldownMs", () => {
  it("prefers milliseconds over seconds and minutes", () => {
    expect(
      ResolveCooldownMs({ milliseconds: 250, seconds: 10, minutes: 1 }),
    ).toBe(250);
  });

  it("converts seconds and minutes to milliseconds", () => {
    expect(ResolveCooldownMs({ seconds: 2 })).toBe(2000);
    expect(ResolveCooldownMs({ minutes: 1 })).toBe(60_000);
    expect(ResolveCooldownMs({})).toBe(0);
  });
});

describe("CooldownMiddleware", () => {
  beforeEach(() => {
    ResetCooldownStoreForTesting();
    ResetCooldownsForTesting();
  });

  it("has name cooldown", () => {
    expect(CooldownMiddleware.name).toBe("cooldown");
  });

  it("calls next when cooldown config is missing", async () => {
    const context = createMiddlewareContext();
    context.config = {};
    const next = vi.fn().mockResolvedValue(undefined);

    await CooldownMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next when resolved cooldown duration is zero", async () => {
    const context = createMiddlewareContext();
    context.config = { cooldown: {} };
    const next = vi.fn().mockResolvedValue(undefined);

    await CooldownMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next when no active cooldown", async () => {
    const context = createMiddlewareContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await CooldownMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(
      context.responders.interactionResponder.Reply,
    ).not.toHaveBeenCalled();
  });

  it("uses plural seconds in active cooldown message", async () => {
    const context = createMiddlewareContext({ cooldownSeconds: 30 });
    RecordCooldown(context);
    const next = vi.fn().mockResolvedValue(undefined);

    await CooldownMiddleware.execute(context, next);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            description: expect.stringMatching(/seconds before using/),
          }),
        ]),
      }),
    );
  });

  it("blocks next and replies when cooldown is active", async () => {
    const context = createMiddlewareContext();
    RecordCooldown(context);
    const next = vi.fn().mockResolvedValue(undefined);

    await CooldownMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Cooldown"),
          }),
        ]),
      }),
    );
  });

  it("does not record cooldown when execute throws", async () => {
    const context = createMiddlewareContext({ cooldownSeconds: 60 });
    const failingExecute = vi.fn().mockRejectedValue(new Error("fail"));

    await RunMiddlewareChain([ErrorMiddleware], context, async () => {
      await failingExecute();
      RecordCooldown(context);
    });

    const next = vi.fn().mockResolvedValue(undefined);
    await CooldownMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("records cooldown only after successful command execution", async () => {
    const interaction = createMockInteraction({
      user: { id: "user-2", username: "ExecUser" },
    });
    const mockContext = createMockContext();
    const responders = createMockResponderSet();
    const logger = createMockLogger();

    const successCommand: CommandDefinition = {
      data: {
        name: "success-cmd",
        description: "Success",
      } as CommandDefinition["data"],
      group: "utility",
      config: { cooldown: { seconds: 30 } },
      middleware: { after: [ErrorMiddleware] },
      execute: vi.fn().mockResolvedValue(undefined),
    };

    const failCommand: CommandDefinition = {
      data: {
        name: "fail-cmd",
        description: "Fail",
      } as CommandDefinition["data"],
      group: "utility",
      config: { cooldown: { seconds: 30 } },
      middleware: { after: [ErrorMiddleware] },
      execute: vi.fn().mockRejectedValue(new Error("fail")),
    };

    const executor = CreateCommandExecutor({
      databases: mockContext.databases,
      appConfig: mockContext.appConfig,
    });

    await executor(successCommand, interaction, responders, logger);

    const successContext = createMiddlewareContext({ cooldownSeconds: 30 });
    successContext.interaction.user.id = "user-2";
    (successContext.command as { data: { name: string } }).data.name =
      "success-cmd";

    const blockNext = vi.fn();
    await CooldownMiddleware.execute(successContext, blockNext);
    expect(blockNext).not.toHaveBeenCalled();

    ResetCooldownsForTesting();

    await executor(failCommand, interaction, responders, logger);

    const failContext = createMiddlewareContext({ cooldownSeconds: 30 });
    failContext.interaction.user.id = "user-2";
    (failContext.command as { data: { name: string } }).data.name = "fail-cmd";

    const allowNext = vi.fn();
    await CooldownMiddleware.execute(failContext, allowNext);
    expect(allowNext).toHaveBeenCalledOnce();
  });

  it("blocks using sqlite-backed cooldown store when persistence is configured", async () => {
    const originalDataDir = process.env.DATA_DIR;
    const tempDir = mkdtempSync(join(tmpdir(), "cooldown-mw-"));
    process.env.DATA_DIR = tempDir;

    const serverDb = new ServerDatabase(createMockLogger());
    ConfigureCooldownPersistence(serverDb);

    const context = createMiddlewareContext({ cooldownSeconds: 30 });
    RecordCooldown(context);

    const next = vi.fn().mockResolvedValue(undefined);
    await CooldownMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();

    serverDb.Close();
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
    ResetCooldownStoreForTesting();
  });
});

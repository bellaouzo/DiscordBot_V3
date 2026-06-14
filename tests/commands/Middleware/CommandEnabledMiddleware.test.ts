import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { CommandEnabledMiddleware } from "@middleware/CommandEnabledMiddleware";
import { ServerDatabase } from "@database/ServerDatabase";
import {
  createMockInteraction,
  createMockLogger,
  createMockResponderSet,
  createMockAppConfig,
} from "../../helpers";
import type { MiddlewareContext } from "@middleware";

function createMiddlewareContext(options: {
  commandName: string;
  guildId?: string;
  serverDb: ServerDatabase;
}): MiddlewareContext {
  const interaction = createMockInteraction({
    guild: options.guildId ? { id: options.guildId, name: "Test Guild" } : null,
    user: { id: "user-1", username: "TestUser" },
  });
  const command = {
    data: { name: options.commandName, description: "Test" },
    group: "utility",
    execute: vi.fn().mockResolvedValue(undefined),
  };

  return {
    interaction,
    command,
    logger: createMockLogger(),
    responders: createMockResponderSet(),
    config: { guildOnly: true },
    databases: {
      serverDb: options.serverDb,
    },
    appConfig: createMockAppConfig(),
  } as unknown as MiddlewareContext;
}

describe("CommandEnabledMiddleware", () => {
  let tempDir: string;
  let originalDataDir: string | undefined;
  let serverDb: ServerDatabase;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "command-enabled-mw-"));
    process.env.DATA_DIR = tempDir;
    serverDb = new ServerDatabase(createMockLogger());
    serverDb.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: ["admin"],
      mod_role_ids: ["mod"],
    });
    serverDb.DisableCommand("guild-1", "meme");
  });

  afterEach(() => {
    serverDb.Close();
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("blocks disabled commands in guilds", async () => {
    const context = createMiddlewareContext({
      commandName: "meme",
      guildId: "guild-1",
      serverDb,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await CommandEnabledMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it("allows protected commands even when disabled in storage", async () => {
    serverDb.DisableCommand("guild-1", "help");
    const context = createMiddlewareContext({
      commandName: "help",
      guildId: "guild-1",
      serverDb,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await CommandEnabledMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next for enabled commands", async () => {
    const context = createMiddlewareContext({
      commandName: "ping",
      guildId: "guild-1",
      serverDb,
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await CommandEnabledMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  BuildMiddlewareChain,
  CreateCommandExecutor,
  ResolveContextMenuInvocation,
  ResolveInvocation,
} from "@bot/ExecuteCommand";
import { CreateCommand, CreateUserMenu } from "@commands";
import type { CommandDefinition } from "@commands";
import { ErrorMiddleware, LoggingMiddleware, ResolveConfig } from "@middleware";
import type { CommandMiddleware } from "@middleware";
import {
  createMockContext,
  createMockInteraction,
  createMockLogger,
  createMockResponderSet,
  stubInteractionOptions,
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

function InteractionFor(
  subcommand: string | null,
  group: string | null = null,
) {
  const interaction = createMockInteraction({ user: { id: "user-1" } });
  stubInteractionOptions(interaction, {
    getSubcommand: () => subcommand,
    getSubcommandGroup: () => group,
  });
  return interaction;
}

const LockdownLike = CreateCommand({
  name: "lockdown",
  description: "Lock channels",
  group: "moderation",
  config: { access: "mod", cooldown: "5s", botPermissions: ["ManageRoles"] },
  subcommandConfig: { status: { botPermissions: [], cooldown: "1s" } },
  execute: vi.fn(),
  configure: (builder) => {
    builder
      .addSubcommand((sub) => sub.setName("channel").setDescription("Lock"))
      .addSubcommand((sub) => sub.setName("status").setDescription("Status"));
  },
});

describe("BuildMiddlewareChain", () => {
  it("wraps the config-driven middleware in the global middleware, error handler first", () => {
    const config = ResolveConfig({
      cooldown: "3s",
      botPermissions: ["BanMembers"],
      autoDefer: true,
    });

    expect(BuildMiddlewareChain(config).map((m) => m.name)).toEqual([
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

  it("adds the permission check for any non-everyone access", () => {
    const names = BuildMiddlewareChain(ResolveConfig({ access: "mod" })).map(
      (m) => m.name,
    );
    expect(names).toContain("permissions");
  });

  it("skips guild-only for commands that allow DMs", () => {
    const names = BuildMiddlewareChain(ResolveConfig({ dms: true })).map(
      (m) => m.name,
    );
    expect(names).not.toContain("guild-only");
  });

  it("does not duplicate global middleware listed in custom middleware", () => {
    const names = BuildMiddlewareChain(ResolveConfig(), {
      before: [LoggingMiddleware],
      after: [ErrorMiddleware],
    }).map((m) => m.name);

    expect(names.filter((name) => name === "logging")).toHaveLength(1);
    expect(names.filter((name) => name === "error-handler")).toHaveLength(1);
  });
});

describe("ResolveInvocation", () => {
  it("applies the subcommand override and gives it its own cooldown key", () => {
    const { invocation, config } = ResolveInvocation(
      LockdownLike,
      InteractionFor("status"),
    );

    expect(invocation).toEqual({
      commandName: "lockdown",
      group: "moderation",
      path: "lockdown status",
      cooldownKey: "lockdown status",
    });
    expect(config.access).toBe("mod");
    expect(config.botPermissions).toEqual([]);
    expect(config.cooldownMs).toBe(1000);
  });

  it("uses the command config and shared cooldown for other subcommands", () => {
    const { invocation, config } = ResolveInvocation(
      LockdownLike,
      InteractionFor("channel"),
    );

    expect(invocation.cooldownKey).toBe("lockdown");
    expect(config.botPermissions).toEqual(["ManageRoles"]);
  });

  it("includes the subcommand group in the path", () => {
    const { invocation } = ResolveInvocation(
      CreateTestCommand(),
      InteractionFor("buy", "market"),
    );
    expect(invocation.path).toBe("test market buy");
  });

  it("resolves a shortcut alias to its command and subcommand", () => {
    const parent = CreateCommand({
      name: "economy",
      description: "Economy",
      group: "fun",
      config: { feature: "economy", cooldown: "5s" },
      subcommands: [
        { name: "daily", description: "Daily", execute: vi.fn(), alias: true },
      ],
    });
    const alias = parent.aliases![0];

    const { invocation, config } = ResolveInvocation(
      alias,
      InteractionFor(null),
    );

    expect(invocation).toEqual({
      commandName: "economy",
      group: "fun",
      path: "economy daily",
      cooldownKey: "economy",
    });
    expect(config.feature).toBe("economy");
  });
});

describe("ResolveContextMenuInvocation", () => {
  it("shares the linked command's name and inherits its subcommand config", () => {
    const menu = CreateUserMenu({
      name: "Check Status",
      command: LockdownLike,
      subcommand: "status",
      execute: vi.fn(),
    });

    const { invocation, config } = ResolveContextMenuInvocation(menu);

    expect(invocation.commandName).toBe("lockdown");
    expect(invocation.path).toBe("Check Status (user menu)");
    expect(config.access).toBe("mod");
    expect(config.botPermissions).toEqual([]);
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

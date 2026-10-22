import { describe, expect, it, vi } from "vitest";
import {
  CreateCommand,
  CreateMessageMenu,
  CreateUserMenu,
  IsContextMenuDefinition,
  ListSubcommandPaths,
} from "@commands";

function EconomyLike() {
  return CreateCommand({
    name: "economy",
    description: "Economy",
    group: "fun",
    config: { feature: "economy", cooldown: "5s" },
    subcommands: [
      {
        name: "balance",
        description: "Check your balance",
        options: (sub) =>
          sub.addUserOption((option) =>
            option.setName("user").setDescription("User"),
          ),
        execute: vi.fn(),
        alias: true,
      },
      {
        name: "market",
        description: "Market",
        subcommands: [
          {
            name: "buy",
            description: "Buy an item",
            execute: vi.fn(),
            alias: "buy-item",
            config: { cooldown: "30s" },
          },
        ],
      },
      { name: "about", description: "About", execute: vi.fn() },
    ],
  });
}

describe("CreateCommand", () => {
  it("lists subcommand paths including groups", () => {
    expect(ListSubcommandPaths(EconomyLike().data)).toEqual([
      "balance",
      "market buy",
      "about",
    ]);
  });

  it("collects per-subcommand config by path", () => {
    expect(EconomyLike().subcommandConfig).toEqual({
      "market buy": { cooldown: "30s" },
    });
  });

  it("generates shortcut aliases with the subcommand's options", () => {
    const command = EconomyLike();
    const aliases = command.aliases ?? [];

    expect(aliases.map((alias) => alias.data.name)).toEqual([
      "balance",
      "buy-item",
    ]);
    expect(aliases[0].aliasOf).toEqual({
      command: "economy",
      subcommand: "balance",
    });
    expect(aliases[0].config).toBe(command.config);
    expect(aliases[0].data.toJSON().options?.map((o) => o.name)).toEqual([
      "user",
    ]);
    expect(aliases[1].aliasOf?.subcommand).toBe("market buy");
  });

  it("does not add an aliases field when no subcommand is marked", () => {
    const command = CreateCommand({
      name: "plain",
      description: "Plain",
      group: "utility",
      execute: vi.fn(),
    });
    expect(command.aliases).toBeUndefined();
  });

  it("throws at startup when subcommandConfig names an unknown subcommand", () => {
    expect(() =>
      CreateCommand({
        name: "lockdown",
        description: "Lock",
        group: "moderation",
        subcommandConfig: { stauts: { botPermissions: [] } },
        execute: vi.fn(),
        configure: (builder) => {
          builder.addSubcommand((sub) =>
            sub.setName("status").setDescription("Status"),
          );
        },
      }),
    ).toThrow(/"stauts", which is not a subcommand/);
  });
});

describe("Context menus", () => {
  it("inherit the linked command's config with the subcommand and menu overrides", () => {
    const parent = EconomyLike();
    const menu = CreateUserMenu({
      name: "Buy For",
      command: parent,
      subcommand: "market buy",
      config: { access: "mod" },
      execute: vi.fn(),
    });

    expect(menu.kind).toBe("user");
    expect(menu.group).toBe("fun");
    expect(menu.linked).toEqual({
      command: "economy",
      subcommand: "market buy",
    });
    expect(menu.config).toEqual({
      feature: "economy",
      cooldown: "30s",
      access: "mod",
    });
    expect(IsContextMenuDefinition(menu)).toBe(true);
    expect(IsContextMenuDefinition(parent)).toBe(false);
  });

  it("throw when the linked subcommand doesn't exist", () => {
    expect(() =>
      CreateMessageMenu({
        name: "Nope",
        command: EconomyLike(),
        subcommand: "missing",
        execute: vi.fn(),
      }),
    ).toThrow(/has no subcommand "missing"/);
  });
});

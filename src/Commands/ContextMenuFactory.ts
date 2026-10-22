import type {
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { ApplicationCommandType, ContextMenuCommandBuilder } from "discord.js";
import type { CommandConfig } from "@middleware/CommandConfig";
import type { CommandContext, CommandDefinition } from "./CommandFactory";
import { ListSubcommandPaths } from "./CommandFactory";

/** Discord allows at most this many user menus and this many message menus per app. */
export const MAX_CONTEXT_MENUS_PER_TYPE = 5;

interface ContextMenuOptions {
  /** Shown in the Apps menu, e.g. "Warn". */
  readonly name: string;
  /**
   * The slash command this menu belongs to. The menu inherits its config (and the subcommand's
   * override), and shares its server toggle, channel restrictions and cooldown.
   */
  readonly command: CommandDefinition;
  /** Subcommand path whose config override also applies, e.g. "add". */
  readonly subcommand?: string;
  /** Overrides on top of the inherited config. */
  readonly config?: CommandConfig;
}

export interface UserContextMenuOptions extends ContextMenuOptions {
  readonly execute: (
    interaction: UserContextMenuCommandInteraction,
    context: CommandContext,
  ) => Promise<void>;
}

export interface MessageContextMenuOptions extends ContextMenuOptions {
  readonly execute: (
    interaction: MessageContextMenuCommandInteraction,
    context: CommandContext,
  ) => Promise<void>;
}

interface ContextMenuDefinitionBase {
  readonly data: ContextMenuCommandBuilder;
  readonly group: string;
  /** Inherited config with the menu's own overrides merged in. */
  readonly config: CommandConfig;
  /** The slash command (and subcommand) this menu belongs to. */
  readonly linked: { readonly command: string; readonly subcommand?: string };
}

export interface UserContextMenuDefinition extends ContextMenuDefinitionBase {
  readonly kind: "user";
  readonly execute: UserContextMenuOptions["execute"];
}

export interface MessageContextMenuDefinition extends ContextMenuDefinitionBase {
  readonly kind: "message";
  readonly execute: MessageContextMenuOptions["execute"];
}

/** A right-click command on a user or a message. */
export type ContextMenuDefinition =
  | UserContextMenuDefinition
  | MessageContextMenuDefinition;

function BuildBase(
  options: ContextMenuOptions,
  type: ApplicationCommandType.User | ApplicationCommandType.Message,
): ContextMenuDefinitionBase {
  const parent = options.command;
  if (
    options.subcommand &&
    !ListSubcommandPaths(parent.data).includes(options.subcommand)
  ) {
    throw new Error(
      `Context menu "${options.name}": /${parent.data.name} has no subcommand "${options.subcommand}"`,
    );
  }

  const data = new ContextMenuCommandBuilder()
    .setName(options.name)
    .setType(type);
  if (parent.data.default_member_permissions !== undefined) {
    data.setDefaultMemberPermissions(parent.data.default_member_permissions);
  }

  return {
    data,
    group: parent.group,
    config: {
      ...parent.config,
      ...(options.subcommand
        ? parent.subcommandConfig?.[options.subcommand]
        : undefined),
      ...options.config,
    },
    linked: {
      command: parent.data.name,
      subcommand: options.subcommand,
    },
  };
}

/**
 * Creates a right-click menu on users (Apps → Warn). Export it from the linked command's file;
 * the loader registers it.
 */
export function CreateUserMenu(
  options: UserContextMenuOptions,
): UserContextMenuDefinition {
  return {
    ...BuildBase(options, ApplicationCommandType.User),
    kind: "user",
    execute: options.execute,
  };
}

/**
 * Creates a right-click menu on messages (Apps → Purge From Here).
 */
export function CreateMessageMenu(
  options: MessageContextMenuOptions,
): MessageContextMenuDefinition {
  return {
    ...BuildBase(options, ApplicationCommandType.Message),
    kind: "message",
    execute: options.execute,
  };
}

/**
 * True for values created by CreateUserMenu / CreateMessageMenu.
 */
export function IsContextMenuDefinition(
  value: unknown,
): value is ContextMenuDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    ((value as { kind: unknown }).kind === "user" ||
      (value as { kind: unknown }).kind === "message")
  );
}

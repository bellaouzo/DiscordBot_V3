import type { PermissionFlagsBits } from "discord.js";
import type { ToggleableFeatureKey } from "@shared/Features";

/** A Discord permission name, e.g. "BanMembers". */
export type PermissionName = keyof typeof PermissionFlagsBits;

/**
 * Who may run a command.
 * - `everyone` (default)
 * - `mod`: configured mod roles, or Ban/Kick/Moderate Members
 * - `admin`: configured admin roles, or Administrator/Manage Server
 * - `serverOwner`: the guild owner
 * - `botOwner`: users in BOT_OWNER_IDS
 */
export type CommandAccess =
  | "everyone"
  | "mod"
  | "admin"
  | "serverOwner"
  | "botOwner";

/** A duration such as "500ms", "5s", "2m" or "1h". */
export type Duration =
  | `${number}ms`
  | `${number}s`
  | `${number}m`
  | `${number}h`;

/**
 * How a command is gated and run. Every field is optional; the defaults are a guild-only
 * command anyone can use, with no cooldown. The same shape is used for per-subcommand
 * overrides, which replace the command's value field by field.
 *
 * @example
 * config: { access: "mod", cooldown: "5s", botPermissions: ["BanMembers"] }
 */
export interface CommandConfig {
  /** Who may run it. Default `"everyone"`. */
  readonly access?: CommandAccess;
  /** Also allow the command in DMs. Default `false` (server only). */
  readonly dms?: boolean;
  /** Discord permissions the user needs, in addition to `access`. */
  readonly userPermissions?: readonly PermissionName[];
  /** With `userPermissions`, one of them is enough instead of all. */
  readonly anyUserPermission?: boolean;
  /** A role ID the user must have. */
  readonly role?: string;
  /** Per-user cooldown, e.g. `"5s"`. `false` removes an inherited cooldown. */
  readonly cooldown?: Duration | false;
  /** Permissions the bot needs in the channel. `[]` removes inherited ones. */
  readonly botPermissions?: readonly PermissionName[];
  /**
   * Defer the reply if the handler hasn't answered within ~2s. `true` defers publicly,
   * `"ephemeral"` privately. Don't use on handlers that call showModal().
   */
  readonly autoDefer?: boolean | "ephemeral";
  /** A per-server feature toggle that must be on, e.g. `"economy"`. */
  readonly feature?: ToggleableFeatureKey;
}

/**
 * CommandConfig with every default filled in. This is what middleware reads.
 */
export interface ResolvedCommandConfig {
  readonly access: CommandAccess;
  readonly guildOnly: boolean;
  readonly userPermissions: readonly PermissionName[];
  readonly anyUserPermission: boolean;
  readonly role?: string;
  readonly cooldownMs: number;
  readonly botPermissions: readonly PermissionName[];
  readonly autoDefer: false | { readonly ephemeral: boolean };
  readonly feature?: ToggleableFeatureKey;
}

const DURATION_UNITS_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };

/**
 * Converts a Duration such as "5s" to milliseconds.
 */
export function DurationToMs(duration: Duration): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration "${duration}"`);
  }
  const unit = match[2] as keyof typeof DURATION_UNITS_MS;
  return Math.round(Number(match[1]) * DURATION_UNITS_MS[unit]);
}

/**
 * Merges config layers (command first, then overrides) and fills in defaults.
 * A field set on a later layer replaces the earlier value.
 */
export function ResolveConfig(
  ...layers: readonly (CommandConfig | undefined)[]
): ResolvedCommandConfig {
  const merged: CommandConfig = Object.assign({}, ...layers.filter(Boolean));

  return {
    access: merged.access ?? "everyone",
    guildOnly: !merged.dms,
    userPermissions: merged.userPermissions ?? [],
    anyUserPermission: merged.anyUserPermission ?? false,
    role: merged.role,
    cooldownMs: merged.cooldown ? DurationToMs(merged.cooldown) : 0,
    botPermissions: merged.botPermissions ?? [],
    autoDefer: merged.autoDefer
      ? { ephemeral: merged.autoDefer === "ephemeral" }
      : false,
    feature: merged.feature,
  };
}

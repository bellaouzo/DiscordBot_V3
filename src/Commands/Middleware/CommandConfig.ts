import type { PermissionFlagsBits } from "discord.js";
import type { ToggleableFeatureKey } from "@shared/Features";

type PermissionName = keyof typeof PermissionFlagsBits;

/**
 * Command configuration: guild-only, permissions, cooldown, role/mod/owner, bot permissions, auto-defer.
 * Used by AutoMiddleware to pick the per-command middleware.
 */
export interface CommandConfig {
  readonly guildOnly?: boolean;
  readonly permissions?: {
    readonly required?: PermissionName[];
    readonly requireAny?: boolean;
  };
  readonly cooldown?: {
    readonly seconds?: number;
    readonly minutes?: number;
    readonly milliseconds?: number;
  };
  readonly role?: string;
  readonly modRole?: boolean;
  readonly adminRole?: boolean;
  readonly owner?: boolean;
  /** Restricts the command to the user IDs in BOT_OWNER_IDS. */
  readonly botOwner?: boolean;
  readonly requiredFeature?: ToggleableFeatureKey;
  /** Permissions the bot itself needs in the channel the command is used in. */
  readonly botPermissions?: {
    readonly required: PermissionName[];
    /** Subcommands that skip the check (read-only views such as `status`). */
    readonly exemptSubcommands?: string[];
  };
  /** Defers the reply if the handler hasn't responded before Discord's 3s deadline. */
  readonly autoDefer?: {
    readonly ephemeral: boolean;
  };
}

/**
 * Fluent builder for CommandConfig. Chain methods then call build().
 */
export class CommandConfigBuilder {
  private config: CommandConfig = {};

  /** Creates a new builder. */
  static create(): CommandConfigBuilder {
    return new CommandConfigBuilder();
  }

  guildOnly(): this {
    this.config = { ...this.config, guildOnly: true };
    return this;
  }

  permissions(...perms: PermissionName[]): this {
    this.config = {
      ...this.config,
      permissions: { ...this.config.permissions, required: perms },
    };
    return this;
  }

  anyPermission(...perms: PermissionName[]): this {
    this.config = {
      ...this.config,
      permissions: {
        ...this.config.permissions,
        required: perms,
        requireAny: true,
      },
    };
    return this;
  }

  cooldownSeconds(seconds: number): this {
    this.config = {
      ...this.config,
      cooldown: { ...this.config.cooldown, seconds },
    };
    return this;
  }

  cooldownMinutes(minutes: number): this {
    this.config = {
      ...this.config,
      cooldown: { ...this.config.cooldown, minutes },
    };
    return this;
  }

  cooldownMs(milliseconds: number): this {
    this.config = {
      ...this.config,
      cooldown: { ...this.config.cooldown, milliseconds },
    };
    return this;
  }

  role(roleId: string): this {
    this.config = { ...this.config, role: roleId };
    return this;
  }

  hasModRole(): this {
    this.config = { ...this.config, modRole: true };
    return this;
  }

  hasAdminRole(): this {
    this.config = { ...this.config, adminRole: true };
    return this;
  }

  owner(): this {
    this.config = { ...this.config, owner: true };
    return this;
  }

  botOwner(): this {
    this.config = { ...this.config, botOwner: true };
    return this;
  }

  botPermissions(...perms: PermissionName[]): this {
    this.config = {
      ...this.config,
      botPermissions: { ...this.config.botPermissions, required: perms },
    };
    return this;
  }

  /** Skips the bot permission check for these subcommands. Call after botPermissions(). */
  skipBotPermissionsFor(...subcommands: string[]): this {
    this.config = {
      ...this.config,
      botPermissions: {
        required: this.config.botPermissions?.required ?? [],
        exemptSubcommands: subcommands,
      },
    };
    return this;
  }

  /** Defers slow handlers automatically. Public by default so the final reply stays visible. */
  autoDefer(options: { ephemeral?: boolean } = {}): this {
    this.config = {
      ...this.config,
      autoDefer: { ephemeral: options.ephemeral ?? false },
    };
    return this;
  }

  requiredFeature(feature: ToggleableFeatureKey): this {
    this.config = { ...this.config, requiredFeature: feature };
    return this;
  }

  /** Returns the built config. */
  build(): CommandConfig {
    return this.config;
  }
}

/**
 * Convenience helpers for command config. mod(), admin(), utility() include guildOnly and cooldown.
 */
export const Config = {
  create: () => CommandConfigBuilder.create(),

  requirePermissions: (...perms: PermissionName[]) =>
    CommandConfigBuilder.create()
      .permissions(...perms)
      .build(),

  requireAnyPermission: (...perms: PermissionName[]) =>
    CommandConfigBuilder.create()
      .anyPermission(...perms)
      .build(),

  requireRole: (roleId: string) =>
    CommandConfigBuilder.create().role(roleId).build(),

  requireOwner: () => CommandConfigBuilder.create().owner().build(),

  // Quick cooldown helpers
  cooldownSeconds: (seconds: number) =>
    CommandConfigBuilder.create().cooldownSeconds(seconds).build(),

  cooldownMinutes: (minutes: number) =>
    CommandConfigBuilder.create().cooldownMinutes(minutes).build(),

  // Combined helpers
  mod: (cooldownSeconds = 5) =>
    CommandConfigBuilder.create()
      .guildOnly()
      .hasModRole()
      .cooldownSeconds(cooldownSeconds),

  admin: (cooldownSeconds = 4) =>
    CommandConfigBuilder.create()
      .guildOnly()
      .hasAdminRole()
      .cooldownSeconds(cooldownSeconds)
      .build(),

  utility: (cooldownSeconds = 1) =>
    CommandConfigBuilder.create()
      .guildOnly()
      .cooldownSeconds(cooldownSeconds)
      .build(),

  utilityWithFeature: (feature: ToggleableFeatureKey, cooldownSeconds = 1) =>
    CommandConfigBuilder.create()
      .guildOnly()
      .cooldownSeconds(cooldownSeconds)
      .requiredFeature(feature)
      .build(),
};

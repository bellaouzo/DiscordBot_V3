import { PermissionFlagsBits } from "discord.js";

/**
 * Command configuration: guild-only, permissions, cooldown, role/mod/owner, and optional custom data.
 * Used by AutoMiddleware to add GuildMiddleware, PermissionMiddleware, CooldownMiddleware.
 */
export interface CommandConfig {
  readonly guildOnly?: boolean;
  readonly permissions?: {
    readonly required?: (keyof typeof PermissionFlagsBits)[];
    readonly requireAny?: boolean;
  };
  readonly cooldown?: {
    readonly seconds?: number;
    readonly minutes?: number;
    readonly milliseconds?: number;
  };
  readonly role?: string;
  readonly modRole?: boolean;
  readonly owner?: boolean;
  readonly custom?: Map<string, unknown>;
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

  permissions(...perms: (keyof typeof PermissionFlagsBits)[]): this {
    this.config = {
      ...this.config,
      permissions: { ...this.config.permissions, required: perms },
    };
    return this;
  }

  anyPermission(...perms: (keyof typeof PermissionFlagsBits)[]): this {
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

  owner(): this {
    this.config = { ...this.config, owner: true };
    return this;
  }

  custom(key: string, value: unknown): this {
    if (!this.config.custom) {
      this.config = { ...this.config, custom: new Map() };
    }
    this.config.custom!.set(key, value);
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

  requirePermissions: (...perms: (keyof typeof PermissionFlagsBits)[]) =>
    CommandConfigBuilder.create()
      .permissions(...perms)
      .build(),

  requireAnyPermission: (...perms: (keyof typeof PermissionFlagsBits)[]) =>
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

  admin: (cooldownSeconds = 10) =>
    CommandConfigBuilder.create()
      .guildOnly()
      .permissions("Administrator")
      .cooldownSeconds(cooldownSeconds)
      .build(),

  utility: (cooldownSeconds = 1) =>
    CommandConfigBuilder.create()
      .guildOnly()
      .cooldownSeconds(cooldownSeconds)
      .build(),
};

import { PermissionFlagsBits } from "discord.js";

export interface CommandConfig {
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
  readonly owner?: boolean;
  readonly custom?: Map<string, unknown>;
}

export class CommandConfigBuilder {
  private config: CommandConfig = {};

  static create(): CommandConfigBuilder {
    return new CommandConfigBuilder();
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

  build(): CommandConfig {
    return this.config;
  }
}

// Convenience functions
export const Config = {
  create: () => CommandConfigBuilder.create(),

  // Quick permission helpers
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
  moderation: (cooldownSeconds = 5) =>
    CommandConfigBuilder.create()
      .permissions("KickMembers", "BanMembers")
      .cooldownSeconds(cooldownSeconds)
      .build(),

  admin: (cooldownSeconds = 10) =>
    CommandConfigBuilder.create()
      .permissions("Administrator")
      .cooldownSeconds(cooldownSeconds)
      .build(),

  utility: (cooldownSeconds = 1) =>
    CommandConfigBuilder.create().cooldownSeconds(cooldownSeconds).build(),
};


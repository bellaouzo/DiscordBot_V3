import {
  CategoryChannel,
  ChannelType,
  Guild,
  GuildBasedChannel,
  GuildMember,
  Role,
  Snowflake,
  TextChannel,
  VoiceChannel,
} from "discord.js";
import { Logger } from "../Shared/Logger";

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 60_000;

class ResourceCache<T> {
  private readonly ttl: number;
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(ttl: number) {
    this.ttl = Math.max(ttl, 0);
  }

  Get(key: string): T | undefined {
    if (this.ttl === 0) {
      return undefined;
    }

    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  Set(key: string, value: T): void {
    if (this.ttl === 0) {
      return;
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  Find(predicate: (value: T) => boolean): T | null {
    if (this.ttl === 0) {
      return null;
    }

    const now = Date.now();

    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        continue;
      }

      if (predicate(entry.value)) {
        return entry.value;
      }
    }

    return null;
  }
}

export interface GuildResourceLocatorOptions {
  readonly guild: Guild;
  readonly logger?: Logger;
  readonly cacheTtlMs?: number;
}

export interface GuildResourceLocator {
  GetChannel(id: Snowflake): Promise<GuildBasedChannel | null>;
  GetChannelByName(name: string): Promise<GuildBasedChannel | null>;
  GetTextChannel(id: Snowflake): Promise<TextChannel | null>;
  GetVoiceChannel(id: Snowflake): Promise<VoiceChannel | null>;
  GetCategoryChannel(id: Snowflake): Promise<CategoryChannel | null>;
  GetRole(id: Snowflake): Promise<Role | null>;
  GetRoleByName(name: string): Promise<Role | null>;
  GetMember(id: Snowflake): Promise<GuildMember | null>;
  EnsureChannel(id: Snowflake): Promise<GuildBasedChannel>;
  EnsureTextChannel(id: Snowflake): Promise<TextChannel>;
  EnsureRole(id: Snowflake): Promise<Role>;
  EnsureMember(id: Snowflake): Promise<GuildMember>;
}

export function CreateGuildResourceLocator(
  options: GuildResourceLocatorOptions
): GuildResourceLocator {
  const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const channelCache = new ResourceCache<GuildBasedChannel>(cacheTtl);
  const roleCache = new ResourceCache<Role>(cacheTtl);
  const memberCache = new ResourceCache<GuildMember>(cacheTtl);

  return {
    GetChannel: (id) =>
      _FetchChannel(options.guild, channelCache, options.logger, id),
    GetChannelByName: (name) =>
      _FetchChannelByName(options.guild, channelCache, options.logger, name),
    GetTextChannel: async (id) =>
      _FilterChannel(
        await _FetchChannel(options.guild, channelCache, options.logger, id),
        ChannelType.GuildText
      ) as TextChannel | null,
    GetVoiceChannel: async (id) =>
      _FilterChannel(
        await _FetchChannel(options.guild, channelCache, options.logger, id),
        ChannelType.GuildVoice
      ) as VoiceChannel | null,
    GetCategoryChannel: async (id) =>
      _FilterChannel(
        await _FetchChannel(options.guild, channelCache, options.logger, id),
        ChannelType.GuildCategory
      ) as CategoryChannel | null,
    GetRole: (id) => _FetchRole(options.guild, roleCache, options.logger, id),
    GetRoleByName: (name) =>
      _FetchRoleByName(options.guild, roleCache, options.logger, name),
    GetMember: (id) =>
      _FetchMember(options.guild, memberCache, options.logger, id),
    EnsureChannel: async (id) =>
      _EnsureResource(
        await _FetchChannel(options.guild, channelCache, options.logger, id),
        `Channel ${id} was not found in guild ${options.guild.id}`
      ),
    EnsureTextChannel: async (id) =>
      _EnsureResource(
        await _FilterChannel(
          await _FetchChannel(options.guild, channelCache, options.logger, id),
          ChannelType.GuildText
        ),
        `Text channel ${id} was not found in guild ${options.guild.id}`
      ) as TextChannel,
    EnsureRole: async (id) =>
      _EnsureResource(
        await _FetchRole(options.guild, roleCache, options.logger, id),
        `Role ${id} was not found in guild ${options.guild.id}`
      ),
    EnsureMember: async (id) =>
      _EnsureResource(
        await _FetchMember(options.guild, memberCache, options.logger, id),
        `Member ${id} was not found in guild ${options.guild.id}`
      ),
  };
}

async function _FetchResource<T>(
  guild: Guild,
  cache: ResourceCache<T>,
  logger: Logger | undefined,
  id: Snowflake,
  fetchFn: (guild: Guild, id: Snowflake) => Promise<T | null>,
  resourceType: string,
  cacheId: string
): Promise<T | null> {
  const cached = cache.Get(cacheId);
  if (cached) {
    return cached;
  }

  try {
    const resource = await fetchFn(guild, id);
    if (!resource) {
      return null;
    }

    cache.Set(cacheId, resource);
    return resource;
  } catch (error) {
    logger?.Warn(`Failed to fetch guild ${resourceType}`, {
      guildId: guild.id,
      extra: { id },
      error,
    });
    return null;
  }
}

async function _FetchResourceByName<T>(
  guild: Guild,
  cache: ResourceCache<T>,
  logger: Logger | undefined,
  name: string,
  fetchAllFn: (guild: Guild) => Promise<Map<string, T>>,
  cacheGetFn: (guild: Guild, id: string) => T | undefined,
  getName: (resource: T) => string | undefined,
  resourceType: string
): Promise<T | null> {
  const normalized = name.toLowerCase();

  const cached = cache.Find((item) => {
    const itemName = getName(item);
    return itemName?.toLowerCase() === normalized;
  });
  if (cached) {
    return cached;
  }

  const existing = cacheGetFn(guild, "");
  if (existing) {
    const existingName = getName(existing);
    if (existingName?.toLowerCase() === normalized) {
      return existing;
    }
  }

  try {
    const allResources = await fetchAllFn(guild);
    const match = Array.from(allResources.values()).find((item) => {
      const itemName = getName(item);
      return itemName?.toLowerCase() === normalized;
    });
    if (!match) {
      return null;
    }

    const matchId = Array.from(allResources.entries()).find(
      ([, item]) => item === match
    )?.[0];
    if (matchId) {
      cache.Set(matchId, match);
    }
    return match;
  } catch (error) {
    logger?.Warn(`Failed to fetch guild ${resourceType} by name`, {
      guildId: guild.id,
      extra: { name },
      error,
    });
    return null;
  }
}

async function _FetchChannel(
  guild: Guild,
  cache: ResourceCache<GuildBasedChannel>,
  logger: Logger | undefined,
  id: Snowflake
): Promise<GuildBasedChannel | null> {
  return _FetchResource(
    guild,
    cache,
    logger,
    id,
    async (g, i) => await g.channels.fetch(i),
    "channel",
    id
  );
}

async function _FetchChannelByName(
  guild: Guild,
  cache: ResourceCache<GuildBasedChannel>,
  logger: Logger | undefined,
  name: string
): Promise<GuildBasedChannel | null> {
  return _FetchResourceByName(
    guild,
    cache,
    logger,
    name,
    async (g) => await g.channels.fetch(),
    () => undefined,
    (channel): string | undefined => {
      if (!channel) return undefined;
      return "name" in channel ? channel.name : undefined;
    },
    "channel"
  );
}

async function _FetchRole(
  guild: Guild,
  cache: ResourceCache<Role>,
  logger: Logger | undefined,
  id: Snowflake
): Promise<Role | null> {
  return _FetchResource(
    guild,
    cache,
    logger,
    id,
    async (g, i) => {
      const existing = g.roles.cache.get(i);
      if (existing) {
        cache.Set(i, existing);
        return existing;
      }
      return await g.roles.fetch(i);
    },
    "role",
    id
  );
}

async function _FetchRoleByName(
  guild: Guild,
  cache: ResourceCache<Role>,
  logger: Logger | undefined,
  name: string
): Promise<Role | null> {
  return _FetchResourceByName(
    guild,
    cache,
    logger,
    name,
    async (g) => await g.roles.fetch(),
    () => undefined,
    (role) => role.name,
    "role"
  );
}

async function _FetchMember(
  guild: Guild,
  cache: ResourceCache<GuildMember>,
  logger: Logger | undefined,
  id: Snowflake
): Promise<GuildMember | null> {
  return _FetchResource(
    guild,
    cache,
    logger,
    id,
    async (g, i) => {
      const existing = g.members.cache.get(i);
      if (existing) {
        cache.Set(i, existing);
        return existing;
      }
      return await g.members.fetch(i);
    },
    "member",
    id
  );
}

function _FilterChannel(
  channel: GuildBasedChannel | null,
  expectedType: ChannelType
): GuildBasedChannel | null {
  if (!channel) {
    return null;
  }

  return channel.type === expectedType ? channel : null;
}

function _EnsureResource<T>(resource: T | null, errorMessage: string): T {
  if (!resource) {
    throw new Error(errorMessage);
  }

  return resource;
}

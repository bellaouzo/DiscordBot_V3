import {
  CategoryChannel,
  ChannelType,
  Guild,
  GuildBasedChannel,
  GuildMember,
  Role,
  Snowflake,
  TextChannel,
  VoiceChannel
} from 'discord.js'
import { Logger } from '../Shared/Logger'

interface CacheEntry<T> {
  readonly value: T
  readonly expiresAt: number
}

const DEFAULT_CACHE_TTL_MS = 60_000

class ResourceCache<T> {
  private readonly ttl: number
  private readonly entries = new Map<string, CacheEntry<T>>()

  constructor(ttl: number) {
    this.ttl = Math.max(ttl, 0)
  }

  Get(key: string): T | undefined {
    if (this.ttl === 0) {
      return undefined
    }

    const entry = this.entries.get(key)
    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)
      return undefined
    }

    return entry.value
  }

  Set(key: string, value: T): void {
    if (this.ttl === 0) {
      return
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttl
    })
  }

  Find(predicate: (value: T) => boolean): T | null {
    if (this.ttl === 0) {
      return null
    }

    const now = Date.now()

    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key)
        continue
      }

      if (predicate(entry.value)) {
        return entry.value
      }
    }

    return null
  }
}

export interface GuildResourceLocatorOptions {
  readonly guild: Guild
  readonly logger?: Logger
  readonly cacheTtlMs?: number
}

export interface GuildResourceLocator {
  GetChannel(id: Snowflake): Promise<GuildBasedChannel | null>
  GetChannelByName(name: string): Promise<GuildBasedChannel | null>
  GetTextChannel(id: Snowflake): Promise<TextChannel | null>
  GetVoiceChannel(id: Snowflake): Promise<VoiceChannel | null>
  GetCategoryChannel(id: Snowflake): Promise<CategoryChannel | null>
  GetRole(id: Snowflake): Promise<Role | null>
  GetRoleByName(name: string): Promise<Role | null>
  GetMember(id: Snowflake): Promise<GuildMember | null>
  EnsureChannel(id: Snowflake): Promise<GuildBasedChannel>
  EnsureTextChannel(id: Snowflake): Promise<TextChannel>
  EnsureRole(id: Snowflake): Promise<Role>
  EnsureMember(id: Snowflake): Promise<GuildMember>
}

export function CreateGuildResourceLocator(options: GuildResourceLocatorOptions): GuildResourceLocator {
  const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const channelCache = new ResourceCache<GuildBasedChannel>(cacheTtl)
  const roleCache = new ResourceCache<Role>(cacheTtl)
  const memberCache = new ResourceCache<GuildMember>(cacheTtl)

  return {
    GetChannel: id => _FetchChannel(options.guild, channelCache, options.logger, id),
    GetChannelByName: name => _FetchChannelByName(options.guild, channelCache, options.logger, name),
    GetTextChannel: async id => _FilterChannel(await _FetchChannel(options.guild, channelCache, options.logger, id), ChannelType.GuildText) as TextChannel | null,
    GetVoiceChannel: async id => _FilterChannel(await _FetchChannel(options.guild, channelCache, options.logger, id), ChannelType.GuildVoice) as VoiceChannel | null,
    GetCategoryChannel: async id => _FilterChannel(await _FetchChannel(options.guild, channelCache, options.logger, id), ChannelType.GuildCategory) as CategoryChannel | null,
    GetRole: id => _FetchRole(options.guild, roleCache, options.logger, id),
    GetRoleByName: name => _FetchRoleByName(options.guild, roleCache, options.logger, name),
    GetMember: id => _FetchMember(options.guild, memberCache, options.logger, id),
    EnsureChannel: async id => _EnsureResource(await _FetchChannel(options.guild, channelCache, options.logger, id), `Channel ${id} was not found in guild ${options.guild.id}`),
    EnsureTextChannel: async id => _EnsureResource(await _FilterChannel(await _FetchChannel(options.guild, channelCache, options.logger, id), ChannelType.GuildText), `Text channel ${id} was not found in guild ${options.guild.id}`) as TextChannel,
    EnsureRole: async id => _EnsureResource(await _FetchRole(options.guild, roleCache, options.logger, id), `Role ${id} was not found in guild ${options.guild.id}`),
    EnsureMember: async id => _EnsureResource(await _FetchMember(options.guild, memberCache, options.logger, id), `Member ${id} was not found in guild ${options.guild.id}`)
  }
}

async function _FetchChannel(
  guild: Guild,
  cache: ResourceCache<GuildBasedChannel>,
  logger: Logger | undefined,
  id: Snowflake
): Promise<GuildBasedChannel | null> {
  const cached = cache.Get(id)
  if (cached) {
    return cached
  }

  try {
    const channel = await guild.channels.fetch(id)
    if (!channel) {
      return null
    }

    cache.Set(id, channel)
    return channel
  } catch (error) {
    logger?.Warn('Failed to fetch guild channel', {
      guildId: guild.id,
      extra: { id },
      error
    })
    return null
  }
}

async function _FetchChannelByName(
  guild: Guild,
  cache: ResourceCache<GuildBasedChannel>,
  logger: Logger | undefined,
  name: string
): Promise<GuildBasedChannel | null> {
  const normalized = name.toLowerCase()

  const cached = cache.Find(channel => 'name' in channel && channel.name?.toLowerCase() === normalized)
  if (cached) {
    return cached
  }

  const existing = guild.channels.cache.find(channel => 'name' in channel && channel.name.toLowerCase() === normalized) as GuildBasedChannel | undefined
  if (existing) {
    cache.Set(existing.id, existing)
    return existing
  }

  try {
    const channels = await guild.channels.fetch()
    const match = channels.find(channel => channel && 'name' in channel && channel.name?.toLowerCase() === normalized) as GuildBasedChannel | undefined
    if (!match) {
      return null
    }

    cache.Set(match.id, match)
    return match
  } catch (error) {
    logger?.Warn('Failed to fetch guild channels by name', {
      guildId: guild.id,
      extra: { name },
      error
    })
    return null
  }
}

async function _FetchRole(
  guild: Guild,
  cache: ResourceCache<Role>,
  logger: Logger | undefined,
  id: Snowflake
): Promise<Role | null> {
  const cached = cache.Get(id)
  if (cached) {
    return cached
  }

  const existing = guild.roles.cache.get(id)
  if (existing) {
    cache.Set(id, existing)
    return existing
  }

  try {
    const role = await guild.roles.fetch(id)
    if (!role) {
      return null
    }

    cache.Set(id, role)
    return role
  } catch (error) {
    logger?.Warn('Failed to fetch guild role', {
      guildId: guild.id,
      extra: { id },
      error
    })
    return null
  }
}

async function _FetchRoleByName(
  guild: Guild,
  cache: ResourceCache<Role>,
  logger: Logger | undefined,
  name: string
): Promise<Role | null> {
  const normalized = name.toLowerCase()

  const cached = cache.Find(role => role.name.toLowerCase() === normalized)
  if (cached) {
    return cached
  }

  const existing = guild.roles.cache.find(role => role.name.toLowerCase() === normalized)
  if (existing) {
    cache.Set(existing.id, existing)
    return existing
  }

  try {
    const roles = await guild.roles.fetch()
    const match = roles.find(role => role.name.toLowerCase() === normalized)
    if (!match) {
      return null
    }

    cache.Set(match.id, match)
    return match
  } catch (error) {
    logger?.Warn('Failed to fetch guild roles by name', {
      guildId: guild.id,
      extra: { name },
      error
    })
    return null
  }
}

async function _FetchMember(
  guild: Guild,
  cache: ResourceCache<GuildMember>,
  logger: Logger | undefined,
  id: Snowflake
): Promise<GuildMember | null> {
  const cached = cache.Get(id)
  if (cached) {
    return cached
  }

  const existing = guild.members.cache.get(id)
  if (existing) {
    cache.Set(id, existing)
    return existing
  }

  try {
    const member = await guild.members.fetch(id)
    if (!member) {
      return null
    }

    cache.Set(id, member)
    return member
  } catch (error) {
    logger?.Warn('Failed to fetch guild member', {
      guildId: guild.id,
      extra: { id },
      error
    })
    return null
  }
}

function _FilterChannel(channel: GuildBasedChannel | null, expectedType: ChannelType): GuildBasedChannel | null {
  if (!channel) {
    return null
  }

  return channel.type === expectedType ? channel : null
}

function _EnsureResource<T>(resource: T | null, errorMessage: string): T {
  if (!resource) {
    throw new Error(errorMessage)
  }

  return resource
}


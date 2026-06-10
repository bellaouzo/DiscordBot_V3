import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type {
  Guild,
  GuildMember,
  Role,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import { ChannelType } from "discord.js";
import { CreateGuildResourceLocator } from "@utilities/GuildResourceLocator";

function createTextChannel(id: string, name = "general"): TextChannel {
  return {
    id,
    name,
    type: ChannelType.GuildText,
  } as TextChannel;
}

function createCategoryChannel(id: string, name = "category"): CategoryChannel {
  return {
    id,
    name,
    type: ChannelType.GuildCategory,
  } as CategoryChannel;
}

describe("GuildResourceLocator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached channel on second GetChannel call", async () => {
    const channel = createTextChannel("ch-1");
    const fetch = vi.fn().mockResolvedValue(channel);
    const guild = {
      id: "guild-1",
      channels: { fetch, cache: new Map() },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild, cacheTtlMs: 60_000 });
    await locator.GetChannel("ch-1");
    await locator.GetChannel("ch-1");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches channel after cache TTL expires", async () => {
    vi.useFakeTimers();
    const channel = createTextChannel("ch-1");
    const fetch = vi.fn().mockResolvedValue(channel);
    const guild = {
      id: "guild-1",
      channels: { fetch, cache: new Map() },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild, cacheTtlMs: 1_000 });
    await locator.GetChannel("ch-1");
    vi.advanceTimersByTime(1_001);
    await locator.GetChannel("ch-1");

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns null for wrong channel type on GetTextChannel", async () => {
    const category = createCategoryChannel("cat-1");
    const fetch = vi.fn().mockResolvedValue(category);
    const guild = {
      id: "guild-1",
      channels: { fetch, cache: new Map() },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    const result = await locator.GetTextChannel("cat-1");
    expect(result).toBeNull();
  });

  it("returns null when channel fetch fails", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("missing"));
    const guild = {
      id: "guild-1",
      channels: { fetch, cache: new Map() },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    const result = await locator.GetChannel("missing");
    expect(result).toBeNull();
  });

  it("finds channel by normalized name via cache Find", async () => {
    const channel = createTextChannel("ch-2", "Announcements");
    const fetchAll = vi
      .fn()
      .mockResolvedValue(new Map([["ch-2", channel]] as const));
    const guild = {
      id: "guild-1",
      channels: {
        fetch: fetchAll,
        cache: new Map(),
      },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    const first = await locator.GetChannelByName("announcements");
    const second = await locator.GetChannelByName("ANNOUNCEMENTS");

    expect(first?.id).toBe("ch-2");
    expect(second?.id).toBe("ch-2");
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it("uses guild role cache before fetching role", async () => {
    const role = { id: "role-1", name: "Mod" } as Role;
    const fetch = vi.fn();
    const guild = {
      id: "guild-1",
      roles: {
        cache: new Map([["role-1", role]]),
        fetch,
      },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    const result = await locator.GetRole("role-1");

    expect(result).toBe(role);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses guild member cache before fetching member", async () => {
    const member = { id: "user-1" } as GuildMember;
    const fetch = vi.fn();
    const guild = {
      id: "guild-1",
      members: {
        cache: new Map([["user-1", member]]),
        fetch,
      },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    const result = await locator.GetMember("user-1");

    expect(result).toBe(member);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws from EnsureChannel when channel is missing", async () => {
    const fetch = vi.fn().mockResolvedValue(null);
    const guild = {
      id: "guild-1",
      channels: { fetch, cache: new Map() },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    await expect(locator.EnsureChannel("missing")).rejects.toThrow(
      "Channel missing was not found",
    );
  });

  it("returns category channel from GetCategoryChannel", async () => {
    const category = createCategoryChannel("cat-3");
    const fetch = vi.fn().mockResolvedValue(category);
    const guild = {
      id: "guild-1",
      channels: { fetch, cache: new Map() },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    const result = await locator.GetCategoryChannel("cat-3");
    expect(result?.id).toBe("cat-3");
  });

  it("finds role by normalized name", async () => {
    const role = { id: "role-2", name: "Support Team" } as Role;
    const fetchAll = vi
      .fn()
      .mockResolvedValue(new Map([["role-2", role]] as const));
    const guild = {
      id: "guild-1",
      roles: { cache: new Map(), fetch: fetchAll },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    const result = await locator.GetRoleByName("support team");
    expect(result?.id).toBe("role-2");
  });

  it("throws from EnsureRole when role is missing", async () => {
    const fetch = vi.fn().mockResolvedValue(null);
    const guild = {
      id: "guild-1",
      roles: { cache: new Map(), fetch },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    await expect(locator.EnsureRole("role-missing")).rejects.toThrow(
      "Role role-missing was not found",
    );
  });

  it("throws from EnsureMember when member is missing", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("missing"));
    const guild = {
      id: "guild-1",
      members: { cache: new Map(), fetch },
    } as unknown as Guild;

    const locator = CreateGuildResourceLocator({ guild });
    await expect(locator.EnsureMember("user-9")).rejects.toThrow(
      "Member user-9 was not found",
    );
  });
});

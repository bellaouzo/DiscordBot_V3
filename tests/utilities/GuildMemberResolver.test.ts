import { describe, expect, it, vi } from "vitest";
import { GuildMember } from "discord.js";

vi.unmock("@utilities/GuildMemberResolver");

const {
  ResolveInteractionMember,
  ResolveMessageMember,
  ResolveGuildMemberSync,
} = await import("@utilities/GuildMemberResolver");

function createGuildMember(userId: string): GuildMember {
  const member = Object.create(GuildMember.prototype) as GuildMember;
  Object.defineProperty(member, "user", {
    value: { id: userId },
    configurable: true,
  });
  return member;
}

describe("GuildMemberResolver", () => {
  it("returns cached GuildMember when instanceof passes", async () => {
    const member = createGuildMember("user-1");
    const interaction = {
      guild: { id: "guild-1" },
      member,
    };

    const resolved = await ResolveInteractionMember(interaction as never);
    expect(resolved).toBe(member);
  });

  it("fetches via guild.members.fetch for API member shape", async () => {
    const fetchedMember = { id: "user-2" } as GuildMember;
    const fetch = vi.fn().mockResolvedValue(fetchedMember);
    const interaction = {
      guild: {
        id: "guild-1",
        members: { fetch },
      },
      member: { user: { id: "user-2" } },
    };

    const resolved = await ResolveInteractionMember(interaction as never);
    expect(fetch).toHaveBeenCalledWith("user-2");
    expect(resolved).toBe(fetchedMember);
  });

  it("returns null when interaction member fetch fails", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("missing"));
    const resolved = await ResolveInteractionMember({
      guild: { id: "guild-1", members: { fetch } },
      member: { user: { id: "user-8" } },
    } as never);
    expect(fetch).toHaveBeenCalledWith("user-8");
    expect(resolved).toBeNull();
  });

  it("returns null when guild or member is missing on interaction", async () => {
    expect(
      await ResolveInteractionMember({ guild: null, member: null } as never),
    ).toBeNull();
    expect(
      await ResolveInteractionMember({
        guild: { id: "guild-1" },
        member: null,
      } as never),
    ).toBeNull();
  });

  it("returns message member when already a GuildMember", async () => {
    const member = createGuildMember("user-3");
    const resolved = await ResolveMessageMember({
      guild: { id: "guild-1" },
      member,
      author: { id: "user-3" },
    } as never);
    expect(resolved).toBe(member);
  });

  it("returns null when message has no guild", async () => {
    const resolved = await ResolveMessageMember({
      guild: null,
      member: null,
      author: { id: "user-6" },
    } as never);
    expect(resolved).toBeNull();
  });

  it("returns null when guild member fetch fails", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("missing"));
    const resolved = await ResolveMessageMember({
      guild: { id: "guild-1", members: { fetch } },
      member: { user: { id: "user-7" } },
      author: { id: "user-7" },
    } as never);
    expect(fetch).toHaveBeenCalledWith("user-7");
    expect(resolved).toBeNull();
  });

  it("fetches message author via guild when member is API shape", async () => {
    const fetchedMember = { id: "user-4" } as GuildMember;
    const fetch = vi.fn().mockResolvedValue(fetchedMember);
    const resolved = await ResolveMessageMember({
      guild: { id: "guild-1", members: { fetch } },
      member: null,
      author: { id: "user-4" },
    } as never);
    expect(fetch).toHaveBeenCalledWith("user-4");
    expect(resolved).toBe(fetchedMember);
  });

  it("returns null from ResolveGuildMemberSync for missing member", () => {
    expect(ResolveGuildMemberSync(null)).toBeNull();
    expect(ResolveGuildMemberSync(undefined)).toBeNull();
  });

  it("casts provided member in ResolveGuildMemberSync", () => {
    const member = { id: "user-5" } as GuildMember;
    expect(ResolveGuildMemberSync(member)).toBe(member);
  });
});

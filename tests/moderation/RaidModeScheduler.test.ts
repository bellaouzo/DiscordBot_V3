import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaidModeScheduler } from "../../src/Moderation/RaidModeScheduler";
import { createMockLogger } from "../helpers";

describe("RaidModeScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores channel permissions and clears raid mode state", async () => {
    const setOverwrites = vi.fn().mockResolvedValue(undefined);
    const setRateLimit = vi.fn().mockResolvedValue(undefined);
    const markCleared = vi.fn();
    const clearStates = vi.fn();
    const channel = {
      manageable: true,
      permissionOverwrites: { set: setOverwrites },
      setRateLimitPerUser: setRateLimit,
    };
    const guild = {
      id: "guild-1",
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(channel),
        },
      },
    };
    const db = {
      ListExpiredRaidModes: vi
        .fn()
        .mockReturnValue([{ id: 9, guild_id: "guild-1" }]),
      ListRaidModeChannelStates: vi.fn().mockReturnValue([
        {
          channel_id: "channel-1",
          overwrites: "[]",
          rate_limit_per_user: 5,
        },
      ]),
      MarkRaidModeCleared: markCleared,
      ClearRaidModeChannelStates: clearStates,
    };
    const client = { guilds: { fetch: vi.fn().mockResolvedValue(guild) } };
    const scheduler = new RaidModeScheduler({
      client: client as never,
      db: db as never,
      logger: createMockLogger(),
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(setOverwrites).toHaveBeenCalledWith([]);
    expect(setRateLimit).toHaveBeenCalledWith(5, "Raid mode expired");
    expect(markCleared).toHaveBeenCalledWith(9);
    expect(clearStates).toHaveBeenCalledWith(9);
  });

  it("clears raid mode when guild is missing", async () => {
    const markCleared = vi.fn();
    const clearStates = vi.fn();
    const db = {
      ListExpiredRaidModes: vi
        .fn()
        .mockReturnValue([{ id: 10, guild_id: "guild-missing" }]),
      ListRaidModeChannelStates: vi.fn(),
      MarkRaidModeCleared: markCleared,
      ClearRaidModeChannelStates: clearStates,
    };
    const client = {
      guilds: { fetch: vi.fn().mockRejectedValue(new Error("missing")) },
    };
    const scheduler = new RaidModeScheduler({
      client: client as never,
      db: db as never,
      logger: createMockLogger(),
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(markCleared).toHaveBeenCalledWith(10);
    expect(clearStates).toHaveBeenCalledWith(10);
  });
});

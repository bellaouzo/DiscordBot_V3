import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TempActionScheduler } from "../../src/Moderation/TempActionScheduler";
import { createMockLogger } from "../helpers";

describe("TempActionScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes expired temp bans", async () => {
    const removeBan = vi.fn().mockResolvedValue(undefined);
    const markProcessed = vi.fn();
    const db = {
      GetPendingTempActions: vi.fn().mockReturnValue([
        {
          id: 1,
          guild_id: "guild-1",
          user_id: "user-1",
          action: "ban",
        },
      ]),
      MarkTempActionProcessed: markProcessed,
    };
    const guild = {
      id: "guild-1",
      bans: {
        fetch: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
        remove: removeBan,
      },
      members: { fetch: vi.fn() },
    };
    const client = { guilds: { fetch: vi.fn().mockResolvedValue(guild) } };
    const scheduler = new TempActionScheduler({
      client: client as never,
      db: db as never,
      logger: createMockLogger(),
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(removeBan).toHaveBeenCalledWith("user-1", "Temporary ban expired");
    expect(markProcessed).toHaveBeenCalledWith(1);
  });

  it("marks processed when guild is unavailable", async () => {
    const markProcessed = vi.fn();
    const db = {
      GetPendingTempActions: vi.fn().mockReturnValue([
        {
          id: 2,
          guild_id: "guild-missing",
          user_id: "user-2",
          action: "ban",
        },
      ]),
      MarkTempActionProcessed: markProcessed,
    };
    const client = {
      guilds: { fetch: vi.fn().mockRejectedValue(new Error("missing")) },
    };
    const scheduler = new TempActionScheduler({
      client: client as never,
      db: db as never,
      logger: createMockLogger(),
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(markProcessed).toHaveBeenCalledWith(2);
  });

  it("clears expired mutes when member is timed out", async () => {
    const timeout = vi.fn().mockResolvedValue(undefined);
    const markProcessed = vi.fn();
    const db = {
      GetPendingTempActions: vi.fn().mockReturnValue([
        {
          id: 3,
          guild_id: "guild-1",
          user_id: "user-3",
          action: "mute",
        },
      ]),
      MarkTempActionProcessed: markProcessed,
    };
    const guild = {
      id: "guild-1",
      bans: { fetch: vi.fn() },
      members: {
        fetch: vi.fn().mockResolvedValue({
          communicationDisabledUntilTimestamp: Date.now() + 1000,
          timeout,
        }),
      },
    };
    const client = { guilds: { fetch: vi.fn().mockResolvedValue(guild) } };
    const scheduler = new TempActionScheduler({
      client: client as never,
      db: db as never,
      logger: createMockLogger(),
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(timeout).toHaveBeenCalledWith(null, "Temporary mute expired");
    expect(markProcessed).toHaveBeenCalledWith(3);
  });
});

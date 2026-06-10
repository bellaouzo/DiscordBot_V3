import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GiveawayScheduler } from "@systems/Giveaway/GiveawayScheduler";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";
import { createMockLogger } from "../../helpers";

describe("GiveawayScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createScheduler(overrides?: {
    endedGiveaways?: Array<{ message_id: string; guild_id: string }>;
    giveaway?: { ended: boolean; channel_id: string } | null;
    channel?: { isTextBased: () => boolean } | null;
  }) {
    const userDb = {
      GetEndedGiveawaysToProcess: vi
        .fn()
        .mockReturnValue(overrides?.endedGiveaways ?? []),
    };
    const channel = overrides?.channel ?? {
      isTextBased: () => true,
    };
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          channels: {
            fetch: vi.fn().mockResolvedValue(channel),
          },
        }),
      },
    };
    const scheduler = new GiveawayScheduler(
      client as never,
      userDb as never,
      createMockLogger(),
    );
    return { scheduler, userDb, client, channel };
  }

  it("finalizes ended giveaways on start", async () => {
    const finalizeGiveaway = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(GiveawayManager.prototype, "GetGiveaway").mockReturnValue({
      ended: false,
      channel_id: "channel-1",
    } as never);
    vi.spyOn(GiveawayManager.prototype, "FinalizeGiveaway").mockImplementation(
      finalizeGiveaway,
    );

    const { scheduler } = createScheduler({
      endedGiveaways: [{ message_id: "msg-1", guild_id: "guild-1" }],
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(finalizeGiveaway).toHaveBeenCalled();
  });

  it("skips giveaways that are already ended", async () => {
    const finalizeGiveaway = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(GiveawayManager.prototype, "GetGiveaway").mockReturnValue({
      ended: true,
      channel_id: "channel-1",
    } as never);
    vi.spyOn(GiveawayManager.prototype, "FinalizeGiveaway").mockImplementation(
      finalizeGiveaway,
    );

    const { scheduler } = createScheduler({
      endedGiveaways: [{ message_id: "msg-1", guild_id: "guild-1" }],
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(finalizeGiveaway).not.toHaveBeenCalled();
  });

  it("warns when scheduler is started twice", () => {
    const logger = createMockLogger();
    const scheduler = new GiveawayScheduler(
      { guilds: { fetch: vi.fn() } } as never,
      { GetEndedGiveawaysToProcess: vi.fn().mockReturnValue([]) } as never,
      logger,
    );

    scheduler.Start();
    scheduler.Start();

    expect(logger.Warn).toHaveBeenCalledWith(
      "GiveawayScheduler already running",
    );
    scheduler.Stop();
  });

  it("logs when giveaway channel is missing", async () => {
    const logger = createMockLogger();
    vi.spyOn(GiveawayManager.prototype, "GetGiveaway").mockReturnValue({
      ended: false,
      channel_id: "channel-1",
    } as never);
    vi.spyOn(GiveawayManager.prototype, "FinalizeGiveaway").mockResolvedValue(
      undefined,
    );

    const scheduler = new GiveawayScheduler(
      {
        guilds: {
          fetch: vi.fn().mockRejectedValue(new Error("guild missing")),
        },
      } as never,
      {
        GetEndedGiveawaysToProcess: vi
          .fn()
          .mockReturnValue([{ message_id: "msg-1", guild_id: "guild-1" }]),
      } as never,
      logger,
    );

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(logger.Warn).toHaveBeenCalledWith(
      "Could not update giveaway message",
      expect.objectContaining({ extra: { messageId: "msg-1" } }),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotteryScheduler } from "@systems/Economy/LotteryScheduler";
import { LotteryManager } from "@systems/Economy/LotteryManager";
import { createMockLogger } from "../../helpers";

describe("LotteryScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("finalizes ended lotteries on start", async () => {
    const finalizeLottery = vi.fn().mockResolvedValue({
      winnerId: "user-1",
      entryCount: 1,
    });
    vi.spyOn(LotteryManager.prototype, "GetLottery").mockReturnValue({
      ended: false,
      channel_id: "channel-1",
      guild_id: "guild-1",
      pot: 100,
    } as never);
    vi.spyOn(LotteryManager.prototype, "FinalizeLottery").mockImplementation(
      finalizeLottery,
    );

    const scheduler = new LotteryScheduler(
      {
        guilds: {
          fetch: vi.fn().mockResolvedValue({
            channels: {
              fetch: vi.fn().mockResolvedValue({ isTextBased: () => true }),
            },
          }),
        },
      } as never,
      {
        GetEndedLotteriesToProcess: vi
          .fn()
          .mockReturnValue([{ guild_id: "guild-1", message_id: "msg-1" }]),
      } as never,
      {
        GetGuildSettings: vi.fn().mockReturnValue({
          guild_id: "guild-1",
          economy_enabled: true,
        }),
      } as never,
      createMockLogger(),
    );

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(finalizeLottery).toHaveBeenCalled();
  });
});

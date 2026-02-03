import { describe, it, expect, vi, beforeEach } from "vitest";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
} from "../../helpers";

describe("EconomyXp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when interaction has no guildId", () => {
    const interaction = createMockInteraction({ guildId: null });
    const context = createMockContext();
    const result = AwardEconomyXp({
      interaction,
      context,
      bet: 0,
      outcome: "win",
    });
    expect(result).toBe(0);
  });

  it("awards XP and does not throw when guildId and user are set", () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.AddXp).mockReturnValue({
      leveledUp: false,
      userXp: {
        user_id: "u1",
        guild_id: "g1",
        xp: 0,
        level: 1,
        total_xp_earned: 0,
        updated_at: Date.now(),
      },
      previousLevel: 1,
    });
    const context = createMockContext({ databases });
    const result = AwardEconomyXp({
      interaction,
      context,
      bet: 100,
      outcome: "win",
    });
    expect(result).toBeGreaterThanOrEqual(1);
    expect(databases.userDb.AddXp).toHaveBeenCalledWith({
      user_id: "u1",
      guild_id: "g1",
      amount: expect.any(Number),
    });
  });

  it("uses outcome multiplier (win gives more than loss)", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.AddXp).mockReturnValue({
      leveledUp: false,
      userXp: {
        user_id: "u1",
        guild_id: "g1",
        xp: 0,
        level: 1,
        total_xp_earned: 0,
        updated_at: Date.now(),
      },
      previousLevel: 1,
    });
    const context = createMockContext({ databases });

    const winXp = AwardEconomyXp({
      interaction: createMockInteraction({
        guildId: "g1",
        user: { id: "u1" } as unknown as import("discord.js").User,
      }),
      context,
      bet: 50,
      outcome: "win",
    });
    const lossXp = AwardEconomyXp({
      interaction: createMockInteraction({
        guildId: "g1",
        user: { id: "u2" } as unknown as import("discord.js").User,
      }),
      context,
      bet: 50,
      outcome: "loss",
    });
    expect(winXp).toBeGreaterThan(lossXp);
  });
});

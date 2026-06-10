import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleCrash } from "@systems/Economy/handlers/CrashHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  stubInteractionOptions,
  captureButtonHandlers,
  invokeRegisteredButton,
  createEconomyGameSetup,
} from "../../helpers";
import { CRASH_TICK_MS, MAX_BET, MIN_BET } from "@systems/Economy/constants";

describe("CrashHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with invalid bet when bet exceeds MAX_BET", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => MAX_BET + 100 });
    const context = createMockContext();
    await HandleCrash(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Invalid Bet");
  });

  it("replies with insufficient balance when bet exceeds balance", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => 50 });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 20,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleCrash(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
  });

  it("deducts bet and starts crash game when balance is sufficient", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 300,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 299,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleCrash(interaction, context);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -MIN_BET }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
    expect(
      context.responders.componentRouter.RegisterButton,
    ).toHaveBeenCalled();
  });

  it("cashes out with positive payout before crash", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
    const databases = createMockDatabaseSet();
    createEconomyGameSetup(databases);
    const context = createMockContext({ databases });
    const handlers = captureButtonHandlers(context.responders.componentRouter);
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await HandleCrash(interaction, context);
    await invokeRegisteredButton(handlers, 0);
    expect(context.responders.buttonResponder.Update).toHaveBeenCalled();
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: expect.any(Number) }),
    );
  });

  it("loses bet when crash occurs without cashout", async () => {
    vi.useFakeTimers();
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
      editReply: vi.fn().mockResolvedValue({}),
    });
    stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
    const databases = createMockDatabaseSet();
    createEconomyGameSetup(databases);
    const context = createMockContext({ databases });
    captureButtonHandlers(context.responders.componentRouter);
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    await HandleCrash(interaction, context);
    await vi.advanceTimersByTimeAsync(CRASH_TICK_MS);
    const positivePayouts = vi
      .mocked(databases.userDb.AdjustBalance)
      .mock.calls.filter((call) => (call[0].delta ?? 0) > 0);
    expect(positivePayouts).toHaveLength(0);
    vi.useRealTimers();
  });
});

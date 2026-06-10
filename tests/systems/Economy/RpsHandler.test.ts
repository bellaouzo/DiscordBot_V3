import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleRps } from "@systems/Economy/handlers/RpsHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  stubInteractionOptions,
  captureButtonHandlers,
  invokeRegisteredButton,
  createEconomyGameSetup,
} from "../../helpers";
import { MAX_BET, MIN_BET } from "@systems/Economy/constants";

describe("RpsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with invalid bet when bet exceeds MAX_BET", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => MAX_BET + 1 });
    const context = createMockContext();
    await HandleRps(interaction, context);
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
    stubInteractionOptions(interaction, { getInteger: () => 100 });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 25,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleRps(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
  });

  it("registers choice buttons and shows prompt when balance is sufficient", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 500,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 499,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleRps(interaction, context);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -MIN_BET }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
    expect(
      context.responders.componentRouter.RegisterButton,
    ).toHaveBeenCalledTimes(4);
  });

  it("pays out on rock beating mocked scissors", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
    const databases = createMockDatabaseSet();
    createEconomyGameSetup(databases);
    const context = createMockContext({ databases });
    const handlers = captureButtonHandlers(context.responders.componentRouter);
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    await HandleRps(interaction, context);
    await invokeRegisteredButton(handlers, 0);
    expect(context.responders.buttonResponder.Update).toHaveBeenCalled();
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: MIN_BET * 2 }),
    );
  });
});

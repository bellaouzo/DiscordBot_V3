import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleScratch } from "@systems/Economy/handlers/ScratchHandler";
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

describe("ScratchHandler", () => {
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
    await HandleScratch(interaction, context);
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
    stubInteractionOptions(interaction, { getInteger: () => 80 });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 40,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleScratch(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
  });

  it("deducts bet and registers scratch slots when balance is sufficient", async () => {
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
    await HandleScratch(interaction, context);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -MIN_BET }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
    expect(
      context.responders.componentRouter.RegisterButton,
    ).toHaveBeenCalled();
  });

  it("reveals a scratch slot when slot button is pressed", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
      editReply: vi.fn().mockResolvedValue({}),
    });
    stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
    const databases = createMockDatabaseSet();
    createEconomyGameSetup(databases);
    const context = createMockContext({ databases });
    const handlers = captureButtonHandlers(context.responders.componentRouter);
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    await HandleScratch(interaction, context);
    await invokeRegisteredButton(handlers, 0);
    expect(context.responders.buttonResponder.Update).toHaveBeenCalled();
  });
});

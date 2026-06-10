import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleFlip } from "@systems/Economy/handlers/FlipHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  stubInteractionOptions,
  captureButtonHandlers,
  invokeRegisteredButton,
  createEconomyGameSetup,
} from "../../helpers";
import { MIN_BET } from "@systems/Economy/constants";

describe("FlipHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with invalid bet when bet exceeds MAX_BET", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => 5000 });
    const context = createMockContext();
    await HandleFlip(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
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
      balance: 50,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleFlip(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
  });

  it("deducts bet and shows flip prompt when balance is sufficient", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 200,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 199,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleFlip(interaction, context);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -MIN_BET }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      }),
    );
    expect(
      context.responders.componentRouter.RegisterButton,
    ).toHaveBeenCalledTimes(3);
  });

  describe("button interactions", () => {
    it("refunds bet on cancel", async () => {
      const interaction = createMockInteraction({
        guildId: "g1",
        user: { id: "u1" } as unknown as import("discord.js").User,
      });
      stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
      const databases = createMockDatabaseSet();
      createEconomyGameSetup(databases);
      const context = createMockContext({ databases });
      const handlers = captureButtonHandlers(
        context.responders.componentRouter,
      );
      await HandleFlip(interaction, context);
      await invokeRegisteredButton(handlers, 2);
      expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
        expect.objectContaining({ delta: MIN_BET }),
      );
      expect(context.responders.buttonResponder.Update).toHaveBeenCalled();
    });

    it("updates embed on heads choice with deterministic win", async () => {
      const interaction = createMockInteraction({
        guildId: "g1",
        user: { id: "u1" } as unknown as import("discord.js").User,
      });
      stubInteractionOptions(interaction, { getInteger: () => MIN_BET });
      const databases = createMockDatabaseSet();
      createEconomyGameSetup(databases);
      const context = createMockContext({ databases });
      const handlers = captureButtonHandlers(
        context.responders.componentRouter,
      );
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      await HandleFlip(interaction, context);
      await invokeRegisteredButton(handlers, 0);
      expect(context.responders.buttonResponder.Update).toHaveBeenCalled();
      expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
        expect.objectContaining({ delta: MIN_BET * 2 }),
      );
    });
  });

  it("replies with invalid bet when bet is below MIN_BET", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, { getInteger: () => -10 });
    const context = createMockContext();
    await HandleFlip(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });
});

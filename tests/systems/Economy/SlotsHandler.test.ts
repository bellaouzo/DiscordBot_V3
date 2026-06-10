import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleSlots } from "@systems/Economy/handlers/SlotsHandler";
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

describe("SlotsHandler", () => {
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
    await HandleSlots(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
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
    const context = createMockContext({ databases });
    await HandleSlots(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
  });

  it("deducts bet and registers spin button when balance is sufficient", async () => {
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
    const context = createMockContext({ databases });
    await HandleSlots(interaction, context);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -MIN_BET }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
    expect(
      context.responders.componentRouter.RegisterButton,
    ).toHaveBeenCalled();
  });

  it("completes spin flow when spin button is pressed", async () => {
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
    const handlers = captureButtonHandlers(context.responders.componentRouter);
    await HandleSlots(interaction, context);
    const spinPromise = invokeRegisteredButton(handlers, 0);
    await vi.runAllTimersAsync();
    await spinPromise;
    expect(context.responders.buttonResponder.Update).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

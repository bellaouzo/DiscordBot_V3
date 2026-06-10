import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleGift } from "@systems/Economy/handlers/GiftHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("GiftHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with invalid amount when amount is zero or negative", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "u2", bot: false }),
      getInteger: () => 0,
    });
    const context = createMockContext();
    await HandleGift(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Invalid Amount");
  });

  it("blocks self-gift", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "u1", bot: false }),
      getInteger: () => 50,
    });
    const context = createMockContext();
    await HandleGift(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Cannot Gift Yourself");
  });

  it("replies with insufficient funds when transfer fails", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "u2", bot: false }),
      getInteger: () => 500,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.TransferBalance).mockReturnValue({
      success: false,
    });
    const context = createMockContext({ databases });
    await HandleGift(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
  });

  it("replies with success embed on successful transfer", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getUser: () => ({ id: "u2", bot: false }),
      getInteger: () => 25,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.TransferBalance).mockReturnValue({
      success: true,
      from: {
        user_id: "u1",
        guild_id: "g1",
        balance: 75,
        updated_at: Date.now(),
      },
      to: {
        user_id: "u2",
        guild_id: "g1",
        balance: 125,
        updated_at: Date.now(),
      },
    });
    const context = createMockContext({ databases });
    await HandleGift(interaction, context);
    expect(databases.userDb.TransferBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        from_user_id: "u1",
        to_user_id: "u2",
        amount: 25,
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });
});

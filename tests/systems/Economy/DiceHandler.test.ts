import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleDice } from "@systems/Economy/handlers/DiceHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";
import { MIN_BET } from "@systems/Economy/constants";

describe("DiceHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with invalid guess when guess is out of range", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getInteger: (name: string) => (name === "guess" ? 7 : 0),
    });
    const context = createMockContext();
    await HandleDice(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Invalid Guess");
  });

  it("replies with insufficient balance when bet exceeds balance", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getInteger: (name: string) => (name === "guess" ? 3 : 50),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 10,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    await HandleDice(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Not Enough Coins");
  });

  it("deducts bet and replies with dice result embed", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getInteger: (name: string) => (name === "guess" ? 4 : MIN_BET),
    });
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
    await HandleDice(interaction, context);
    expect(databases.userDb.AdjustBalance).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -MIN_BET }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it("rolls without guess on free play", async () => {
    const interaction = createMockInteraction({
      guildId: "g1",
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getInteger: (name: string) => (name === "guess" ? null : 0),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
      user_id: "u1",
      guild_id: "g1",
      balance: 200,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    const context = createMockContext({ databases });
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await HandleDice(interaction, context);
    expect(databases.userDb.AdjustBalance).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });
});

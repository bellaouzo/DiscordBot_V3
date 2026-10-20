import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BetRangeError,
  HasItem,
  PrepareWager,
} from "@systems/Economy/utils/Wager";
import { ITEM_MAP } from "@systems/Economy/items";
import { MAX_BET, MIN_BET } from "@systems/Economy/constants";
import type { InventoryEntry } from "@systems/Economy/types";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

function inventoryEntry(itemId: string, quantity: number): InventoryEntry {
  return { userId: "u1", guildId: "g1", itemId, quantity, updatedAt: 0 };
}

describe("Wager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BetRangeError", () => {
    it("accepts a free play bet of 0 by default", () => {
      expect(BetRangeError(0)).toBeNull();
    });

    it("rejects a bet of 0 when free play is disallowed", () => {
      expect(BetRangeError(0, { allowFree: false })).toContain(String(MIN_BET));
    });

    it("accepts the range bounds and rejects values outside them", () => {
      expect(BetRangeError(MIN_BET)).toBeNull();
      expect(BetRangeError(MAX_BET)).toBeNull();
      expect(BetRangeError(MAX_BET + 1)).not.toBeNull();
      expect(BetRangeError(-1)).not.toBeNull();
    });
  });

  describe("HasItem", () => {
    const item = Object.values(ITEM_MAP)[0];

    it("is true only when the item has positive quantity", () => {
      expect(HasItem([inventoryEntry(item.id, 1)], item)).toBe(true);
      expect(HasItem([inventoryEntry(item.id, 0)], item)).toBe(false);
      expect(HasItem([inventoryEntry("other", 3)], item)).toBe(false);
    });

    it("is false for a missing catalog item", () => {
      expect(HasItem([inventoryEntry(item.id, 1)], undefined)).toBe(false);
    });
  });

  describe("PrepareWager", () => {
    function setup(bet: number | null, balance: number) {
      const interaction = createMockInteraction({
        guildId: "g1",
        user: { id: "u1" } as unknown as import("discord.js").User,
      });
      stubInteractionOptions(interaction, { getInteger: () => bet });
      const databases = createMockDatabaseSet();
      vi.mocked(databases.userDb.EnsureBalance).mockReturnValue({
        user_id: "u1",
        guild_id: "g1",
        balance,
        updated_at: Date.now(),
      });
      const context = createMockContext({ databases });
      const reply = context.responders.interactionResponder.Reply as ReturnType<
        typeof vi.fn
      >;
      return { interaction, context, databases, reply };
    }

    it("returns the wager without deducting when the bet is affordable", async () => {
      const { interaction, context, databases, reply } = setup(MIN_BET, 500);

      const prepared = await PrepareWager(interaction, context);

      expect(prepared).toMatchObject({ bet: MIN_BET, balance: 500 });
      expect(reply).not.toHaveBeenCalled();
      expect(databases.userDb.AdjustBalance).not.toHaveBeenCalled();
    });

    it("treats a missing bet option as a free play", async () => {
      const { interaction, context } = setup(null, 0);

      const prepared = await PrepareWager(interaction, context);

      expect(prepared?.bet).toBe(0);
    });

    it("rejects out-of-range bets before touching the balance", async () => {
      const { interaction, context, databases, reply } = setup(
        MAX_BET + 1,
        999_999,
      );

      expect(await PrepareWager(interaction, context)).toBeNull();
      expect(reply.mock.calls[0][1].embeds[0].title).toBe("Invalid Bet");
      expect(databases.userDb.EnsureBalance).not.toHaveBeenCalled();
    });

    it("rejects bets larger than the balance", async () => {
      const { interaction, context, reply } = setup(MIN_BET + 10, MIN_BET);

      expect(await PrepareWager(interaction, context)).toBeNull();
      expect(reply.mock.calls[0][1].embeds[0].title).toBe("Not Enough Coins");
    });

    it("uses a custom warning builder when given", async () => {
      const { interaction, context } = setup(MIN_BET + 10, MIN_BET);
      const builder = vi.fn(
        (title: string, description: string) =>
          ({ toJSON: () => ({ title, description }) }) as never,
      );

      await PrepareWager(interaction, context, builder);

      expect(builder).toHaveBeenCalledWith(
        "Not Enough Coins",
        expect.any(String),
        MIN_BET,
      );
    });
  });
});

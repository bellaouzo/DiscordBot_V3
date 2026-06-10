import { MessageFlags } from "discord.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HandleInventory,
  HandleMarketBuy,
  HandleMarketRefresh,
  HandleMarketSell,
  HandleMarketView,
} from "@systems/Economy/handlers/MarketHandler";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";
import { ITEM_MAP } from "@systems/Economy/items";

const paginatorStart = vi.fn().mockResolvedValue(undefined);

vi.mock("@shared/Paginator", () => ({
  Paginator: class MockPaginator {
    Start = paginatorStart;
    constructor() {}
  },
}));

describe("MarketHandler", () => {
  const guildId = "g1";
  const itemId = "reroll-token";

  beforeEach(() => {
    vi.clearAllMocks();
    paginatorStart.mockClear();
  });

  function mockRotation(databases: ReturnType<typeof createMockDatabaseSet>) {
    vi.mocked(databases.userDb.GetMarketRotation).mockReturnValue({
      guildId,
      items: [itemId],
      generatedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
  }

  it("HandleMarketView starts paginator with market offers", async () => {
    const interaction = createMockInteraction({
      guildId,
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    mockRotation(databases);
    const context = createMockContext({ databases });
    await HandleMarketView(interaction, context);
    expect(paginatorStart).toHaveBeenCalled();
  });

  it("HandleMarketRefresh starts paginator after refresh", async () => {
    const interaction = createMockInteraction({
      guildId,
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    mockRotation(databases);
    const context = createMockContext({ databases });
    await HandleMarketRefresh(interaction, context);
    expect(databases.userDb.SetMarketRotation).toHaveBeenCalled();
    expect(paginatorStart).toHaveBeenCalled();
  });

  it("HandleMarketBuy replies with success embed on purchase", async () => {
    const interaction = createMockInteraction({
      guildId,
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getString: () => itemId,
      getInteger: () => 1,
    });
    const databases = createMockDatabaseSet();
    mockRotation(databases);
    vi.mocked(databases.userDb.GetBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 500,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 400,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([]);
    vi.mocked(databases.userDb.AdjustInventoryQuantity).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      item_id: itemId,
      quantity: 1,
      updated_at: Date.now(),
    });
    const context = createMockContext({ databases });
    await HandleMarketBuy(interaction, context);
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
    expect(embed.title).toBe("✅ Market Buy");
    expect(embed.description).toContain(ITEM_MAP[itemId].name);
  });

  it("HandleMarketBuy replies with error embed when item unavailable", async () => {
    const interaction = createMockInteraction({
      guildId,
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getString: () => "lucky-coin",
      getInteger: () => 1,
    });
    const databases = createMockDatabaseSet();
    mockRotation(databases);
    const context = createMockContext({ databases });
    await HandleMarketBuy(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Market Error");
  });

  it("HandleMarketSell replies with success embed on sale", async () => {
    const interaction = createMockInteraction({
      guildId,
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    stubInteractionOptions(interaction, {
      getString: () => itemId,
      getInteger: () => 1,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([
      {
        userId: "u1",
        guildId,
        itemId,
        quantity: 2,
        updatedAt: Date.now(),
      },
    ]);
    vi.mocked(databases.userDb.AdjustBalance).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      balance: 150,
      updated_at: Date.now(),
    });
    vi.mocked(databases.userDb.AdjustInventoryQuantity).mockReturnValue({
      user_id: "u1",
      guild_id: guildId,
      item_id: itemId,
      quantity: 1,
      updated_at: Date.now(),
    });
    const context = createMockContext({ databases });
    await HandleMarketSell(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("✅ Market Sell");
  });

  it("HandleInventory replies with inventory embed", async () => {
    const interaction = createMockInteraction({
      guildId,
      user: { id: "u1" } as unknown as import("discord.js").User,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetInventory).mockReturnValue([
      {
        userId: "u1",
        guildId,
        itemId,
        quantity: 3,
        updatedAt: Date.now(),
      },
    ]);
    const context = createMockContext({ databases });
    await HandleInventory(interaction, context);
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
    expect(embed.title).toMatch(/Inventory/i);
  });
});

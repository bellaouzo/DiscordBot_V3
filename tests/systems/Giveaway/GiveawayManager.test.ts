import { describe, it, expect, vi, beforeEach } from "vitest";
import { GiveawayManager } from "@systems/Giveaway/GiveawayManager";
import { createMockDatabaseSet } from "../../helpers";

describe("GiveawayManager", () => {
  const guildId = "guild-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CreateGiveawayMessage returns embed, row, and customId", () => {
    const userDb = createMockDatabaseSet().userDb;
    const manager = new GiveawayManager(guildId, userDb);
    const endsAt = Date.now() + 3600000;
    const result = manager.CreateGiveawayMessage({
      prize: "Test Prize",
      endsAt,
      winnerCount: 1,
      hostId: "host-1",
      entryCount: 0,
    });
    expect(result.embed).toBeDefined();
    expect(result.row).toBeDefined();
    expect(result.customId).toMatch(/^giveaway_enter_/);
    const embedJson = result.embed.toJSON();
    expect(embedJson.title).toContain("GIVEAWAY");
    expect(embedJson.description).toContain("Test Prize");
  });

  it("CreateEndedEmbed returns embed with winner mentions", () => {
    const userDb = createMockDatabaseSet().userDb;
    const manager = new GiveawayManager(guildId, userDb);
    const embed = manager.CreateEndedEmbed({
      prize: "Prize",
      winners: ["w1", "w2"],
      hostId: "h1",
      entryCount: 5,
    });
    const json = embed.toJSON();
    expect(json.title).toContain("ENDED");
    expect(json.description).toContain("<@w1>");
    expect(json.description).toContain("<@w2>");
  });

  it("CreateEndedEmbed handles no winners", () => {
    const userDb = createMockDatabaseSet().userDb;
    const manager = new GiveawayManager(guildId, userDb);
    const embed = manager.CreateEndedEmbed({
      prize: "Prize",
      winners: [],
      hostId: "h1",
      entryCount: 0,
    });
    expect(embed.toJSON().description).toContain("No valid entries");
  });

  it("SaveGiveaway calls userDb.CreateGiveaway and returns giveaway", () => {
    const databases = createMockDatabaseSet();
    const giveaway = {
      id: 1,
      guild_id: guildId,
      channel_id: "ch1",
      message_id: "msg1",
      host_id: "h1",
      prize: "Prize",
      winner_count: 1,
      ends_at: Date.now() + 3600000,
      ended: 0,
      created_at: Date.now(),
    };
    vi.mocked(databases.userDb.CreateGiveaway).mockReturnValue(
      giveaway as never
    );
    const manager = new GiveawayManager(guildId, databases.userDb);
    const result = manager.SaveGiveaway({
      channelId: "ch1",
      messageId: "msg1",
      hostId: "h1",
      prize: "Prize",
      winnerCount: 1,
      endsAt: Date.now() + 3600000,
    });
    expect(result).toEqual(giveaway);
    expect(databases.userDb.CreateGiveaway).toHaveBeenCalled();
  });

  it("SelectWinners returns empty when no entries", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetGiveawayEntries).mockReturnValue([]);
    const manager = new GiveawayManager(guildId, databases.userDb);
    const winners = manager.SelectWinners(1, 1);
    expect(winners).toEqual([]);
  });

  it("SelectWinners returns up to count winners", () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetGiveawayEntries).mockReturnValue([
      "u1",
      "u2",
      "u3",
    ]);
    const manager = new GiveawayManager(guildId, databases.userDb);
    const winners = manager.SelectWinners(1, 2);
    expect(winners).toHaveLength(2);
    expect(["u1", "u2", "u3"]).toContain(winners[0]);
    expect(["u1", "u2", "u3"]).toContain(winners[1]);
  });

  it("GetGiveaway delegates to userDb.GetGiveawayByMessageId", () => {
    const databases = createMockDatabaseSet();
    const giveaway = {
      id: 1,
      guild_id: guildId,
      channel_id: "ch1",
      message_id: "msg1",
      host_id: "h1",
      prize: "P",
      winner_count: 1,
      ends_at: Date.now(),
      ended: 0,
      created_at: Date.now(),
    };
    vi.mocked(databases.userDb.GetGiveawayByMessageId).mockReturnValue(
      giveaway as never
    );
    const manager = new GiveawayManager(guildId, databases.userDb);
    expect(manager.GetGiveaway("msg1")).toEqual(giveaway);
    expect(databases.userDb.GetGiveawayByMessageId).toHaveBeenCalledWith(
      "msg1"
    );
  });
});

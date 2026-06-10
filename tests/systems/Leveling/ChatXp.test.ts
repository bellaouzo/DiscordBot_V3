import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { UserDatabase } from "@database/UserDatabase";
import { AwardChatXp, ResetChatXpCooldowns } from "@systems/Leveling/ChatXp";
import { createMockLogger } from "../../helpers";

describe("ChatXp", () => {
  let serverDb: ServerDatabase;
  let userDb: UserDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    ResetChatXpCooldowns();
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "chat-xp-"));
    process.env.DATA_DIR = tempDir;
    const logger = createMockLogger();
    serverDb = new ServerDatabase(logger);
    userDb = new UserDatabase(logger);
    serverDb.UpsertGuildXpSettings({
      guild_id: "guild-1",
      enabled: true,
    });
  });

  afterEach(() => {
    userDb.Close();
    serverDb.Close();
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
    ResetChatXpCooldowns();
  });

  it("awards xp when enabled and message is long enough", () => {
    const result = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "hello world",
      userDb,
      serverDb,
    });

    expect(result.awarded).toBe(15);
    expect(userDb.EnsureUserXp("user-1", "guild-1").xp).toBe(15);
  });

  it("does not award xp when disabled", () => {
    serverDb.UpsertGuildXpSettings({
      guild_id: "guild-1",
      enabled: false,
    });

    const result = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "hello world",
      userDb,
      serverDb,
    });

    expect(result.awarded).toBe(0);
  });

  it("does not award xp in excluded channels", () => {
    serverDb.UpsertGuildXpSettings({
      guild_id: "guild-1",
      enabled: true,
      excluded_channel_ids: ["channel-1"],
    });

    const result = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "hello world",
      userDb,
      serverDb,
    });

    expect(result.awarded).toBe(0);
  });

  it("enforces cooldown between awards", () => {
    vi.useFakeTimers();
    const first = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "first message",
      userDb,
      serverDb,
    });
    const second = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "second message",
      userDb,
      serverDb,
    });

    expect(first.awarded).toBe(15);
    expect(second.awarded).toBe(0);

    vi.advanceTimersByTime(61_000);
    const third = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "third message",
      userDb,
      serverDb,
    });

    expect(third.awarded).toBe(15);
    vi.useRealTimers();
  });

  it("enforces daily cap", () => {
    serverDb.UpsertGuildXpSettings({
      guild_id: "guild-1",
      enabled: true,
      cooldown_seconds: 0,
      daily_cap: 20,
      xp_per_message: 15,
    });

    const first = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "first message",
      userDb,
      serverDb,
    });
    const second = AwardChatXp({
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageContent: "second message",
      userDb,
      serverDb,
    });

    expect(first.awarded).toBe(15);
    expect(second.awarded).toBe(5);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase feature stores", () => {
  let db: ServerDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-features-"));
    process.env.DATA_DIR = tempDir;
    db = new ServerDatabase(createMockLogger());
  });

  afterEach(() => {
    db.Close();
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("persists verification guild settings fields", () => {
    const saved = db.UpsertGuildSettings({
      guild_id: "guild-1",
      admin_role_ids: ["admin"],
      mod_role_ids: ["mod"],
      verification_enabled: true,
      unverified_role_id: "role-unverified",
      verified_role_id: "role-verified",
      verification_min_account_age_days: 7,
      verification_channel_id: "channel-1",
    });

    expect(saved.verification_enabled).toBe(true);
    expect(saved.unverified_role_id).toBe("role-unverified");
    expect(saved.verified_role_id).toBe("role-verified");
    expect(saved.verification_min_account_age_days).toBe(7);
    expect(saved.verification_channel_id).toBe("channel-1");
  });

  it("manages level role rewards", () => {
    db.UpsertLevelRoleReward({
      guild_id: "guild-1",
      level: 5,
      role_id: "role-5",
    });
    db.UpsertLevelRoleReward({
      guild_id: "guild-1",
      level: 10,
      role_id: "role-10",
    });

    const rewards = db.GetLevelRoleRewards("guild-1");
    expect(rewards).toHaveLength(2);
    expect(rewards[0]).toEqual({
      guild_id: "guild-1",
      level: 5,
      role_id: "role-5",
    });

    db.UpsertLevelRoleReward({
      guild_id: "guild-1",
      level: 5,
      role_id: "role-5-updated",
    });
    expect(db.GetLevelRoleReward("guild-1", 5)?.role_id).toBe("role-5-updated");

    expect(db.RemoveLevelRoleReward("guild-1", 10)).toBe(true);
    expect(db.GetLevelRoleRewards("guild-1")).toHaveLength(1);
  });

  it("manages disabled commands per guild", () => {
    expect(db.IsCommandDisabled("guild-1", "meme")).toBe(false);

    db.DisableCommand("guild-1", "meme");
    expect(db.IsCommandDisabled("guild-1", "meme")).toBe(true);
    expect(db.ListDisabledCommands("guild-1")).toEqual(["meme"]);

    expect(db.EnableCommand("guild-1", "meme")).toBe(true);
    expect(db.IsCommandDisabled("guild-1", "meme")).toBe(false);
  });

  it("pings successfully", () => {
    expect(db.Ping()).toBe(true);
  });
});

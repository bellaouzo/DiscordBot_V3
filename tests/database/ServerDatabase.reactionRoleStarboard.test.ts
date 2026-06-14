import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ServerDatabase } from "@database/ServerDatabase";
import { createMockLogger } from "../helpers";

describe("ServerDatabase reaction role and starboard stores", () => {
  let db: ServerDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "server-db-rr-sb-"));
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

  it("creates and lists reaction role panels with mappings", () => {
    const panel = db.CreateReactionRolePanel({
      guild_id: "guild-1",
      channel_id: "channel-1",
      message_id: "message-1",
      created_by: "user-1",
    });

    expect(panel.guild_id).toBe("guild-1");
    expect(db.GetReactionRolePanelById("guild-1", panel.id)?.message_id).toBe(
      "message-1",
    );
    expect(
      db.GetReactionRolePanelByMessage("guild-1", "message-1")?.id,
    ).toBe(panel.id);

    const mapping = db.AddReactionRoleMapping({
      panel_id: panel.id,
      emoji: "⭐",
      role_id: "role-1",
    });
    expect(mapping.emoji).toBe("⭐");
    expect(db.ListReactionRoleMappings(panel.id)).toHaveLength(1);
    expect(
      db.GetReactionRoleMappingByPanelAndEmoji(panel.id, "⭐")?.role_id,
    ).toBe("role-1");
    expect(
      db.GetReactionRoleMappingByEmoji("guild-1", "message-1", "⭐")?.role_id,
    ).toBe("role-1");

    const allMappings = db.ListAllReactionRoleMappings("guild-1");
    expect(allMappings).toHaveLength(1);
    expect(allMappings[0].channel_id).toBe("channel-1");

    expect(db.ListReactionRolePanels("guild-1")).toHaveLength(1);
    expect(db.ListReactionRolePanelsByChannel("guild-1", "channel-1")).toHaveLength(
      1,
    );

    const removed = db.RemoveReactionRoleMappingByPanelAndEmoji(panel.id, "⭐");
    expect(removed?.role_id).toBe("role-1");
    expect(db.ListReactionRoleMappings(panel.id)).toHaveLength(0);

    expect(db.DeleteReactionRolePanel(panel.id)).toBe(true);
    expect(db.GetReactionRolePanelById("guild-1", panel.id)).toBeNull();
  });

  it("manages starboard entries", () => {
    const entry = db.CreateStarboardEntry({
      guild_id: "guild-1",
      source_channel_id: "source-channel",
      source_message_id: "source-message",
      starboard_message_id: "starboard-message",
      star_count: 3,
    });

    expect(entry.star_count).toBe(3);
    expect(
      db.GetStarboardEntry("guild-1", "source-message")?.starboard_message_id,
    ).toBe("starboard-message");

    expect(
      db.UpdateStarboardEntryCount("guild-1", "source-message", 5),
    ).toBe(true);
    expect(db.GetStarboardEntry("guild-1", "source-message")?.star_count).toBe(
      5,
    );

    expect(db.DeleteStarboardEntry("guild-1", "source-message")).toBe(true);
    expect(db.GetStarboardEntry("guild-1", "source-message")).toBeNull();
  });
});

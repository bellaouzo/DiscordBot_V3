import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ModerationDatabase } from "@database/ModerationDatabase";
import { createMockLogger } from "../helpers";

describe("ModerationDatabase appeal operations", () => {
  let db: ModerationDatabase;
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "mod-db-appeals-"));
    process.env.DATA_DIR = tempDir;
    db = new ModerationDatabase(createMockLogger());
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

  it("creates, fetches, and lists appeals with filters", () => {
    const first = db.AddAppeal({
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "warning",
      action_ref: "5",
      reason: "first",
    });
    const second = db.AddAppeal({
      guild_id: "guild-1",
      user_id: "user-2",
      action_type: "ban",
      action_ref: "8",
      reason: "second",
    });

    const fetched = db.GetAppealById(first.id);
    expect(fetched?.reason).toBe("first");

    const userAppeals = db.ListAppeals({
      guild_id: "guild-1",
      user_id: "user-1",
    });
    expect(userAppeals).toHaveLength(1);
    expect(userAppeals[0].id).toBe(first.id);

    const banAppeals = db.ListAppeals({
      guild_id: "guild-1",
      action_type: "ban",
      limit: 10,
    });
    expect(banAppeals).toHaveLength(1);
    expect(banAppeals[0].id).toBe(second.id);
  });

  it("updates review message and resolves an open appeal once", () => {
    const appeal = db.AddAppeal({
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "mute",
      action_ref: "12",
      reason: "need review",
    });

    const updated = db.UpdateAppealReviewMessage({
      id: appeal.id,
      review_channel_id: "channel-1",
      review_message_id: "message-1",
    });
    expect(updated).toBe(true);

    const reviewed = db.GetAppealById(appeal.id);
    expect(reviewed?.review_channel_id).toBe("channel-1");
    expect(reviewed?.review_message_id).toBe("message-1");

    const resolved = db.ResolveAppeal({
      id: appeal.id,
      status: "approved",
      resolved_by: "mod-1",
      resolved_reason: "valid appeal",
    });
    expect(resolved?.status).toBe("approved");
    expect(resolved?.resolved_by).toBe("mod-1");
    expect(resolved?.resolved_at).not.toBeNull();

    const secondResolve = db.ResolveAppeal({
      id: appeal.id,
      status: "denied",
      resolved_by: "mod-2",
    });
    expect(secondResolve).toBeNull();
  });

  it("removes temp actions and moderation events used by appeal cleanup", () => {
    const tempAction = db.AddTempAction({
      action: "mute",
      guild_id: "guild-1",
      user_id: "user-1",
      moderator_id: "mod-1",
      reason: "temp mute",
      expires_at: Date.now() + 60_000,
    });
    expect(db.RemoveTempActionById(tempAction.id)).toBe(true);
    expect(db.RemoveTempActionById(tempAction.id)).toBe(false);

    db.AddModerationEvent({
      guild_id: "guild-1",
      user_id: "user-1",
      moderator_id: "mod-1",
      action: "ban",
      reason: "ban reason",
    });
    const event = db.ListModerationEvents({
      guild_id: "guild-1",
      user_id: "user-1",
      action: "ban",
      limit: 1,
    })[0];

    expect(
      db.RemoveModerationEventById({
        id: event.id,
        guild_id: "guild-1",
        action: "ban",
      })
    ).toBe(true);
    expect(
      db.RemoveModerationEventById({
        id: event.id,
        guild_id: "guild-1",
        action: "ban",
      })
    ).toBe(false);
  });
});

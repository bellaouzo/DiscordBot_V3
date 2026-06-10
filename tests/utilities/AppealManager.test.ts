import { describe, expect, it, vi } from "vitest";
import { CreateAppealManager } from "@utilities/AppealManager";
import { createMockDatabaseSet, createMockLogger } from "../helpers";

describe("AppealManager", () => {
  function createManager() {
    const databases = createMockDatabaseSet();
    return {
      databases,
      manager: CreateAppealManager({
        guildId: "guild-1",
        userId: "user-1",
        moderationDb: databases.moderationDb,
        userDb: databases.userDb,
        logger: createMockLogger(),
      }),
    };
  }

  it("rejects warning appeals when no warnings exist", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([]);

    const result = manager.ValidateTarget({
      actionType: "warning",
      actionRef: "1",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No warnings");
  });

  it("defaults to the latest warning when no action ref is provided", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 1,
        user_id: "user-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "First",
        created_at: 1_700_000_000_000,
      },
      {
        id: 2,
        user_id: "user-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "Latest",
        created_at: 1_700_000_200_000,
      },
    ] as never);

    const result = manager.ValidateTarget({ actionType: "warning" });

    expect(result.success).toBe(true);
    expect(result.target?.actionRef).toBe("2");
  });

  it("validates a specific warning target", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 3,
        user_id: "user-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "Spam",
        created_at: 1_700_000_000_000,
      },
    ] as never);
    vi.mocked(databases.userDb.GetWarningById).mockReturnValue({
      id: 3,
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      reason: "Spam",
      created_at: 1_700_000_000_000,
    } as never);

    const result = manager.ValidateTarget({
      actionType: "warning",
      actionRef: "3",
    });

    expect(result.success).toBe(true);
    expect(result.target?.actionRef).toBe("3");
  });

  it("rejects invalid warning references", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 3,
        user_id: "user-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "Spam",
        created_at: 1_700_000_000_000,
      },
    ] as never);

    const result = manager.ValidateTarget({
      actionType: "warning",
      actionRef: "abc",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("positive numeric ID");
  });

  it("filters actions that already have open appeals", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 9,
        user_id: "user-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "Language",
        created_at: 1_700_000_100_000,
      },
    ] as never);
    vi.mocked(databases.moderationDb.HasOpenAppealForAction).mockReturnValue(
      true,
    );

    const actions = manager.ListAppealableActions("warning");

    expect(actions).toHaveLength(0);
  });

  it("lists appealable warnings and filters open appeals", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 9,
        user_id: "user-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "Language",
        created_at: 1_700_000_100_000,
      },
    ] as never);
    vi.mocked(databases.moderationDb.HasOpenAppealForAction).mockReturnValue(
      false,
    );

    const actions = manager.ListAppealableActions("warning");

    expect(actions).toHaveLength(1);
    expect(actions[0].actionRef).toBe("9");
  });

  it("validates mute targets and rejects missing records", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.moderationDb.ListUserTempActions).mockReturnValue([]);

    const empty = manager.ValidateTarget({
      actionType: "mute",
      actionRef: "2",
    });
    expect(empty.success).toBe(false);

    vi.mocked(databases.moderationDb.ListUserTempActions).mockReturnValue([
      {
        id: 8,
        guild_id: "guild-1",
        user_id: "user-1",
        moderator_id: "mod-1",
        action: "mute",
        reason: "Spam",
        created_at: 1_700_000_000_000,
        processed: false,
      },
    ] as never);

    const valid = manager.ValidateTarget({
      actionType: "mute",
      actionRef: "8",
    });
    expect(valid.success).toBe(true);
    expect(valid.target?.actionType).toBe("mute");
  });

  it("validates ban and kick moderation events", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.moderationDb.ListModerationEvents).mockReturnValue([
      {
        id: 5,
        guild_id: "guild-1",
        user_id: "user-1",
        moderator_id: "mod-1",
        action: "ban",
        reason: "Harassment",
        created_at: 1_700_000_000_000,
      },
    ] as never);

    const ban = manager.ValidateTarget({ actionType: "ban", actionRef: "5" });
    expect(ban.success).toBe(true);

    vi.mocked(databases.moderationDb.ListModerationEvents).mockReturnValue([
      {
        id: 2,
        guild_id: "guild-1",
        user_id: "user-1",
        moderator_id: "mod-1",
        action: "kick",
        reason: "Spam",
        created_at: 1_700_000_000_000,
      },
    ] as never);

    const kick = manager.ValidateTarget({ actionType: "kick" });
    expect(kick.success).toBe(true);
    expect(kick.target?.actionRef).toBe("2");
  });

  it("lists appealable mute and moderation actions", () => {
    const { manager, databases } = createManager();
    vi.mocked(databases.moderationDb.ListUserTempActions).mockReturnValue([
      {
        id: 4,
        guild_id: "guild-1",
        user_id: "user-1",
        moderator_id: "mod-1",
        action: "mute",
        reason: "Spam",
        created_at: 1_700_000_000_000,
        processed: true,
      },
    ] as never);
    vi.mocked(databases.moderationDb.ListModerationEvents).mockReturnValue([
      {
        id: 6,
        guild_id: "guild-1",
        user_id: "user-1",
        moderator_id: "mod-1",
        action: "ban",
        reason: "Harassment",
        created_at: 1_700_000_100_000,
      },
    ] as never);
    vi.mocked(databases.moderationDb.HasOpenAppealForAction).mockReturnValue(
      false,
    );

    const actions = manager.ListAppealableActions();

    expect(actions.map((entry) => entry.actionType)).toEqual(
      expect.arrayContaining(["mute", "ban"]),
    );
  });

  it("creates appeals through the moderation database", () => {
    const { manager, databases } = createManager();
    const appeal = {
      id: 11,
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "ban" as const,
      action_ref: "4",
      reason: "Unfair ban",
      evidence: null,
      status: "open" as const,
      review_channel_id: null,
      review_message_id: null,
      resolved_by: null,
      resolved_reason: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      resolved_at: null,
    };
    vi.mocked(databases.moderationDb.AddAppeal).mockReturnValue(appeal);

    const created = manager.CreateAppeal({
      actionType: "ban",
      actionRef: "4",
      reason: "Unfair ban",
    });

    expect(created).toEqual(appeal);
    expect(databases.moderationDb.AddAppeal).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",
        user_id: "user-1",
        action_type: "ban",
      }),
    );
  });
});

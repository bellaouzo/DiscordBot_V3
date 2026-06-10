import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChannelType, MessageFlags } from "discord.js";
import type { Guild, User } from "discord.js";
import { LockdownCommand } from "@commands/Moderation/LockdownCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("LockdownCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies lockdown and calls AddLockdown on channel subcommand", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    const channel = {
      id: "ch-1",
      type: ChannelType.GuildText,
      guild: { id: "guild-1" },
      permissionOverwrites: {
        cache: { values: () => [] },
        edit,
      },
    };
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "channel",
      getChannel: () => channel,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.GetActiveLockdown).mockReturnValue(null);
    const context = createMockContext({ databases });
    await LockdownCommand.execute(interaction, context);
    expect(edit).toHaveBeenCalled();
    expect(databases.moderationDb.AddLockdown).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "channel",
        target_id: "ch-1",
        applied_by: "mod-1",
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it("lifts lockdown via MarkLockdownLifted on unlock subcommand", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const channel = {
      id: "ch-1",
      type: ChannelType.GuildText,
      permissionOverwrites: { set },
    };
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        channels: { cache: { get: vi.fn().mockReturnValue(channel) } },
      } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "unlock",
      getChannel: () => channel,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.moderationDb.GetActiveLockdown).mockReturnValue({
      id: 3,
      scope: "channel",
      guild_id: "guild-1",
      target_id: "ch-1",
      applied_by: "mod-1",
      applied_at: Date.now(),
      lifted_at: null,
      overwrites: "[]",
    });
    const context = createMockContext({ databases });
    await LockdownCommand.execute(interaction, context);
    expect(set).toHaveBeenCalled();
    expect(databases.moderationDb.MarkLockdownLifted).toHaveBeenCalledWith(3);
  });
});

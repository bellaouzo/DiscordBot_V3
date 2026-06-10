import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, User } from "discord.js";
import { WarnCommand } from "@commands/Moderation/WarnCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("WarnCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds warning via userDb on warn add subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "add",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
      getString: () => "spam",
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.AddWarning).mockReturnValue({
      id: 1,
      user_id: "target-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      reason: "spam",
      created_at: Date.now(),
    });
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 1,
        user_id: "target-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "spam",
        created_at: Date.now(),
      },
    ]);
    const context = createMockContext({ databases });
    await WarnCommand.execute(interaction, context);
    expect(databases.userDb.AddWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        moderator_id: "mod-1",
        reason: "spam",
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

  it("shows no warnings when list target has none", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1", tag: "Mod#0001" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([]);
    const context = createMockContext({ databases });
    await WarnCommand.execute(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "No Warnings" }),
        ]),
      }),
    );
  });

  it("lists warnings for target user on list subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 3,
        user_id: "target-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "spam",
        created_at: Date.now(),
      },
      {
        id: 4,
        user_id: "target-1",
        guild_id: "guild-1",
        moderator_id: "mod-2",
        reason: "toxic",
        created_at: Date.now(),
      },
    ]);
    const context = createMockContext({ databases });
    await WarnCommand.execute(interaction, context);
    expect(context.responders.paginatedResponder.Send).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction,
        pages: expect.arrayContaining([
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: expect.stringContaining("Warnings for"),
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it("removes warning by number on remove subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "remove",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
      getInteger: () => 1,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetWarnings).mockReturnValue([
      {
        id: 42,
        user_id: "target-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        reason: "spam",
        created_at: Date.now(),
      },
    ]);
    vi.mocked(databases.userDb.RemoveWarningById).mockReturnValue(true);
    const context = createMockContext({ databases });
    await WarnCommand.execute(interaction, context);
    expect(databases.userDb.RemoveWarningById).toHaveBeenCalledWith(42, "guild-1");
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
  });
});

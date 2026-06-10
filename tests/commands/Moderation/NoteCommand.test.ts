import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { Guild, GuildMember, User } from "discord.js";
import { NoteCommand } from "@commands/Moderation/NoteCommand";
import {
  createMockContext,
  createMockInteraction,
  createMockDatabaseSet,
  stubInteractionOptions,
} from "../../helpers";

describe("NoteCommand behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createModeratorMember(hasBanPermission = true) {
    return {
      roles: {
        cache: {
          some: vi.fn((predicate: (role: { id: string }) => boolean) =>
            predicate({ id: "mod-role-id" }),
          ),
        },
      },
      permissions: {
        has: vi.fn((permission: string) =>
          permission === "BanMembers" ? hasBanPermission : false,
        ),
      },
    };
  }

  it("warns when removing a note id that does not exist", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "remove",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
      getInteger: () => 3,
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetNotes).mockReturnValue([]);
    const context = createMockContext({ databases });
    await NoteCommand.execute(interaction, context);
    const embed = (
      context.responders.interactionResponder.Reply as ReturnType<typeof vi.fn>
    ).mock.calls[0][1].embeds[0];
    expect(embed.title).toBe("Note Not Found");
  });

  it("adds a note via userDb on add subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "add",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
      getString: () => "watch closely",
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetNotes).mockReturnValue([
      {
        id: 1,
        user_id: "target-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        content: "watch closely",
        created_at: Date.now(),
      },
    ]);
    const context = createMockContext({ databases });
    await NoteCommand.execute(interaction, context);
    expect(databases.userDb.AddNote).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        moderator_id: "mod-1",
        content: "watch closely",
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

  it("shows no notes when list target has none", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1", tag: "Mod#0001" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetNotes).mockReturnValue([]);
    const context = createMockContext({ databases });
    await NoteCommand.execute(interaction, context);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "No Notes" }),
        ]),
      }),
    );
  });

  it("lists notes via paginated responder on list subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "mod-1", tag: "Mod#0001" } as unknown as User,
      member: createModeratorMember() as unknown as GuildMember,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
      getUser: () => ({ id: "target-1", tag: "Target#0001" }),
    });
    const databases = createMockDatabaseSet();
    vi.mocked(databases.userDb.GetNotes).mockReturnValue([
      {
        id: 1,
        user_id: "target-1",
        guild_id: "guild-1",
        moderator_id: "mod-1",
        content: "first note",
        created_at: Date.now(),
      },
    ]);
    const context = createMockContext({ databases });
    await NoteCommand.execute(interaction, context);
    expect(context.responders.paginatedResponder.Send).toHaveBeenCalled();
  });
});

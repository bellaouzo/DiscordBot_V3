import { describe, expect, it, vi } from "vitest";
import { MessageFlags, type Guild, type User } from "discord.js";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../helpers";
import { AppealAdminCommand } from "@commands/Moderation/AppealAdminCommand";

describe("AppealAdminCommand behavior", () => {
  it("blocks review for non-reviewer members", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(false) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "mod-1", username: "ModOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "review",
      getInteger: () => 1,
      getString: (name) => (name === "decision" ? "denied" : null),
    });

    const context = createMockContext();
    await AppealAdminCommand.execute(interaction, context);

    expect(context.databases.moderationDb.ResolveAppeal).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Permission Denied"),
          }),
        ]),
      }),
    );
  });

  it("resolves approved review and removes warning record", async () => {
    const dmSend = vi.fn().mockResolvedValue(undefined);
    const interaction = createMockInteraction({
      guild: {
        id: "guild-1",
        name: "Test Guild",
      } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "mod-1", username: "ModOne" } as unknown as User,
      client: {
        users: {
          fetch: vi.fn().mockResolvedValue({
            send: dmSend,
          }),
        },
      } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "review",
      getInteger: () => 42,
      getString: (name) => (name === "decision" ? "approved" : null),
    });

    const context = createMockContext();
    (
      context.databases.moderationDb.ResolveAppeal as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 42,
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "warning",
      action_ref: "14",
      reason: "Appeal reason",
      evidence: null,
      status: "approved",
      review_channel_id: null,
      review_message_id: null,
      resolved_by: "mod-1",
      resolved_reason: "Resolved by /appeal review (approved)",
      created_at: Date.now(),
      updated_at: Date.now(),
      resolved_at: Date.now(),
    });
    (
      context.databases.userDb.RemoveWarningById as ReturnType<typeof vi.fn>
    ).mockReturnValue(true);

    await AppealAdminCommand.execute(interaction, context);

    expect(context.databases.moderationDb.ResolveAppeal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        status: "approved",
        resolved_by: "mod-1",
      }),
    );
    expect(context.databases.userDb.RemoveWarningById).toHaveBeenCalledWith(
      14,
      "guild-1",
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Appeal Resolved"),
          }),
        ]),
      }),
    );
    expect(dmSend).toHaveBeenCalled();
  });

  it("lists open appeals for reviewers", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "mod-1", username: "ModOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
    });

    const context = createMockContext();
    (
      context.databases.moderationDb.ListAppeals as ReturnType<typeof vi.fn>
    ).mockReturnValue([
      {
        id: 7,
        guild_id: "guild-1",
        user_id: "user-1",
        action_type: "ban",
        action_ref: "3",
        reason: "appeal reason",
        evidence: null,
        status: "open",
        review_channel_id: "channel-99",
        review_message_id: "message-99",
        resolved_by: null,
        resolved_reason: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        resolved_at: null,
      },
    ]);

    await AppealAdminCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Open Appeals"),
          }),
        ]),
      }),
    );
  });

  it("blocks list for non-reviewer members", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(false) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "user-1", username: "UserOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
    });

    const context = createMockContext();
    await AppealAdminCommand.execute(interaction, context);

    expect(context.databases.moderationDb.ListAppeals).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Permission Denied"),
          }),
        ]),
      }),
    );
  });

  it("paginates open appeals when list exceeds page size", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "mod-1", username: "ModOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
    });

    const context = createMockContext();
    const appeals = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      guild_id: "guild-1",
      user_id: `user-${index + 1}`,
      action_type: "warning",
      action_ref: String(index + 1),
      reason: "appeal reason",
      evidence: null,
      status: "open",
      review_channel_id: null,
      review_message_id: null,
      resolved_by: null,
      resolved_reason: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      resolved_at: null,
    }));
    (
      context.databases.moderationDb.ListAppeals as ReturnType<typeof vi.fn>
    ).mockReturnValue(appeals);

    await AppealAdminCommand.execute(interaction, context);

    expect(context.responders.paginatedResponder.Send).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction,
        ownerId: "mod-1",
        pages: expect.any(Array),
      }),
    );
    expect(
      context.responders.interactionResponder.Reply,
    ).not.toHaveBeenCalled();
  });

  it("shows empty state when no open appeals", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "mod-1", username: "ModOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "list",
    });

    const context = createMockContext();
    (
      context.databases.moderationDb.ListAppeals as ReturnType<typeof vi.fn>
    ).mockReturnValue([]);

    await AppealAdminCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            description: expect.stringContaining("no open appeals"),
          }),
        ]),
      }),
    );
  });

  it("resolves denied review without removing moderation action", async () => {
    const dmSend = vi.fn().mockResolvedValue(undefined);
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      } as never,
      user: { id: "mod-1", username: "ModOne" } as unknown as User,
      client: {
        users: {
          fetch: vi.fn().mockResolvedValue({ send: dmSend }),
        },
      } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "review",
      getInteger: () => 9,
      getString: (name) =>
        name === "decision" ? "denied" : "Not convincing enough",
    });

    const context = createMockContext();
    (
      context.databases.moderationDb.ResolveAppeal as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 9,
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "ban",
      action_ref: "3",
      reason: "Appeal reason",
      evidence: null,
      status: "denied",
      review_channel_id: null,
      review_message_id: null,
      resolved_by: "mod-1",
      resolved_reason: "Not convincing enough",
      created_at: Date.now(),
      updated_at: Date.now(),
      resolved_at: Date.now(),
    });

    await AppealAdminCommand.execute(interaction, context);

    expect(context.databases.moderationDb.ResolveAppeal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        status: "denied",
        resolved_reason: "Not convincing enough",
      }),
    );
    expect(context.databases.userDb.RemoveWarningById).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Appeal Resolved"),
          }),
        ]),
      }),
    );
    expect(dmSend).toHaveBeenCalled();
  });
});

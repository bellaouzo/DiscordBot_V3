import { describe, expect, it, vi } from "vitest";

import type { Guild, User } from "discord.js";

import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../helpers";

import { AppealCommand } from "@commands/Moderation/AppealCommand";

describe("AppealCommand behavior", () => {
  it("handles submit interaction lifecycle from select to modal creation", async () => {
    const guild = {
      id: "guild-1",

      name: "Test Guild",

      channels: {
        cache: { get: vi.fn().mockReturnValue(null) },

        create: vi.fn().mockResolvedValue(null),
      },

      members: {
        fetch: vi.fn().mockResolvedValue({
          id: "user-1",

          user: { username: "UserOne" },
        }),

        fetchMe: vi.fn().mockResolvedValue({ id: "bot-1" }),
      },
    } as unknown as Guild;

    const interaction = createMockInteraction({
      guild,

      user: { id: "user-1", username: "UserOne", tag: "UserOne#0001" } as never,

      client: {
        users: {
          fetch: vi.fn().mockResolvedValue({ username: "ModOne" }),
        },
      } as never,
    });

    stubInteractionOptions(interaction, {
      getSubcommand: () => "submit",

      getString: () => null,
    });

    const context = createMockContext();

    (
      context.databases.userDb.GetWarnings as ReturnType<typeof vi.fn>
    ).mockReturnValue([
      {
        id: 21,

        user_id: "user-1",

        guild_id: "guild-1",

        moderator_id: "mod-1",

        reason: "warn reason",

        created_at: Date.now(),
      },
    ]);

    (
      context.databases.userDb.GetWarningById as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 21,

      user_id: "user-1",

      guild_id: "guild-1",

      moderator_id: "mod-1",

      reason: "warn reason",

      created_at: Date.now(),
    });

    (
      context.databases.moderationDb.AddAppeal as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 55,

      guild_id: "guild-1",

      user_id: "user-1",

      action_type: "warning",

      action_ref: "21",

      reason: "I understand now",

      evidence: null,

      status: "open",

      review_channel_id: null,

      review_message_id: null,

      resolved_by: null,

      resolved_reason: null,

      created_at: Date.now(),

      updated_at: Date.now(),

      resolved_at: null,
    });

    await AppealCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Defer).toHaveBeenCalledWith(
      interaction,

      true,
    );

    const selectRegistration = (
      context.responders.selectMenuRouter.RegisterSelectMenu as ReturnType<
        typeof vi.fn
      >
    ).mock.calls[0][0];

    const selectInteraction = {
      values: ["warning:21"],

      showModal: vi.fn().mockResolvedValue(undefined),

      reply: vi.fn().mockResolvedValue(undefined),

      followUp: vi.fn().mockResolvedValue(undefined),

      replied: false,

      deferred: false,
    };

    await selectRegistration.handler(selectInteraction);

    expect(selectInteraction.showModal).toHaveBeenCalledTimes(1);

    expect(context.responders.modalRouter.RegisterModal).toHaveBeenCalledTimes(
      1,
    );

    const modalRegistration = (
      context.responders.modalRouter.RegisterModal as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];

    const modalInteraction = {
      user: { id: "user-1", username: "UserOne", tag: "UserOne#0001" },

      fields: {
        getTextInputValue: vi

          .fn()

          .mockImplementation((field: string) =>
            field === "reason" ? "I understand now" : "",
          ),
      },

      deferReply: vi.fn().mockResolvedValue(undefined),

      editReply: vi.fn().mockResolvedValue(undefined),
    };

    await modalRegistration.handler(modalInteraction);

    expect(modalInteraction.deferReply).toHaveBeenCalled();

    expect(context.databases.moderationDb.AddAppeal).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "guild-1",

        user_id: "user-1",

        action_type: "warning",

        action_ref: "21",
      }),
    );

    const editPayload = (modalInteraction.editReply as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { embeds: Array<{ title?: string }> };

    const title = editPayload.embeds[0]?.title ?? "";

    expect(title).toMatch(/Appeal/);
  });

  it("shows no appeals message on my subcommand when empty", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      user: { id: "user-1", username: "UserOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "my",
    });

    const context = createMockContext();
    (
      context.databases.moderationDb.ListAppeals as ReturnType<typeof vi.fn>
    ).mockReturnValue([]);

    await AppealCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: expect.stringContaining("No Appeals") }),
        ]),
      }),
    );
  });

  it("lists user appeals on my subcommand", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      user: { id: "user-1", username: "UserOne" } as unknown as User,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "my",
    });

    const context = createMockContext();
    (
      context.databases.moderationDb.ListAppeals as ReturnType<typeof vi.fn>
    ).mockReturnValue([
      {
        id: 3,
        guild_id: "guild-1",
        user_id: "user-1",
        action_type: "warning",
        action_ref: "7",
        reason: "appeal reason",
        evidence: null,
        status: "open",
        review_channel_id: "ch-review",
        review_message_id: null,
        resolved_by: null,
        resolved_reason: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        resolved_at: null,
      },
    ]);
    (
      context.databases.userDb.GetWarningById as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 7,
      user_id: "user-1",
      guild_id: "guild-1",
      moderator_id: "mod-1",
      reason: "warn",
      created_at: Date.now(),
    });

    await AppealCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Your Appeals"),
          }),
        ]),
      }),
    );
  });

  it("replies with nothing-to-appeal when submit has no records", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,

      user: { id: "user-1", username: "UserOne" } as unknown as User,
    });

    stubInteractionOptions(interaction, {
      getSubcommand: () => "submit",

      getString: () => null,
    });

    const context = createMockContext();

    await AppealCommand.execute(interaction, context);

    expect(context.responders.interactionResponder.Defer).toHaveBeenCalledWith(
      interaction,

      true,
    );

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,

      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Nothing To Appeal"),
          }),
        ]),
      }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { ProcessAppealSubmission } from "@commands/Moderation/Appeal/AppealSubmitModalFlow";
import { createMockContext, createMockLogger } from "../../helpers";

const appealRecord = {
  id: 42,
  guild_id: "guild-1",
  user_id: "user-1",
  action_type: "warning" as const,
  action_ref: "7",
  reason: "Unfair warning",
  evidence: "Screenshot link",
  status: "open" as const,
  review_channel_id: null,
  review_message_id: null,
  resolved_by: null,
  resolved_reason: null,
  created_at: Date.now(),
  updated_at: Date.now(),
  resolved_at: null,
};

vi.mock("@utilities/AppealManager", () => ({
  CreateAppealManager: vi.fn(() => ({
    ValidateTarget: vi.fn().mockReturnValue({
      success: true,
      target: {
        actionType: "warning",
        actionRef: "7",
        context: "Warning #7",
      },
    }),
    CreateAppeal: vi.fn().mockReturnValue(appealRecord),
  })),
}));

function createGuild(overrides?: {
  createChannel?: () => Promise<unknown>;
}) {
  const reviewChannel = {
    id: "review-channel",
    type: ChannelType.GuildText,
    send: vi.fn().mockResolvedValue({ id: "review-message" }),
    toString: () => "#appeal-review",
  };

  const channels = new Map<string, unknown>([
    ["cat-appeals", { id: "cat-appeals", type: ChannelType.GuildCategory }],
  ]);

  return {
    id: "guild-1",
    name: "Test Guild",
    channels: {
      cache: {
        get: (id: string) => channels.get(id) ?? null,
        filter: () => ({ size: 0, first: () => null }),
      },
      create: vi
        .fn()
        .mockImplementation(
          overrides?.createChannel ?? (async () => reviewChannel),
        ),
    },
    members: {
      fetchMe: vi.fn().mockResolvedValue({ id: "bot-1" }),
      fetch: vi.fn().mockResolvedValue({ id: "user-1" }),
    },
  };
}

describe("Appeal submit modal lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves appeal, creates review channel, and registers decision buttons", async () => {
    const guild = createGuild();
    const modalInteraction = {
      user: { id: "user-1", username: "Appealer", tag: "Appealer#0001" },
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    const context = createMockContext();
    const registerButton = vi
      .fn()
      .mockImplementationOnce(() => ({ customId: "approve-btn" }))
      .mockImplementationOnce(() => ({ customId: "deny-btn" }));
    context.responders.componentRouter.RegisterButton = registerButton;
    (
      context.databases.moderationDb.AddAppeal as ReturnType<typeof vi.fn>
    ).mockReturnValue(appealRecord);
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: ["mod-role"],
      appeal_review_category_id: "cat-appeals",
    });

    await ProcessAppealSubmission({
      modalInteraction: modalInteraction as never,
      context,
      guild: guild as never,
      reason: "Unfair warning",
      evidence: "Screenshot link",
      target: {
        actionType: "warning",
        actionRef: "7",
        context: "Warning #7",
        createdAt: Date.now(),
        preview: "Warning preview",
        moderatorId: "mod-1",
      },
    });

    expect(modalInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Appeal Submitted" }),
        ]),
      }),
    );
    expect(guild.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining("appeal-42"),
        type: ChannelType.GuildText,
        permissionOverwrites: expect.arrayContaining([
          expect.objectContaining({
            id: "guild-1",
            deny: [PermissionFlagsBits.ViewChannel],
          }),
        ]),
      }),
    );
    expect(registerButton).toHaveBeenCalledTimes(2);
    expect(
      context.databases.moderationDb.UpdateAppealReviewMessage,
    ).toHaveBeenCalledWith({
      id: 42,
      review_channel_id: "review-channel",
      review_message_id: "review-message",
    });
  });

  it("warns and still confirms appeal when review channel creation fails", async () => {
    const guild = createGuild({
      createChannel: async () => null,
    });
    const modalInteraction = {
      user: { id: "user-1", username: "Appealer", tag: "Appealer#0001" },
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    const context = createMockContext();
    context.logger = createMockLogger();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);

    await ProcessAppealSubmission({
      modalInteraction: modalInteraction as never,
      context,
      guild: guild as never,
      reason: "Unfair warning",
      evidence: null,
      target: {
        actionType: "warning",
        actionRef: "7",
        context: "Warning #7",
        createdAt: Date.now(),
        preview: "Warning preview",
        moderatorId: "mod-1",
      },
    });

    expect(modalInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: "Staff Review",
                value: expect.stringContaining("Queued"),
              }),
            ]),
          }),
        ]),
      }),
    );
    expect(context.logger.Warn).toHaveBeenCalledWith(
      "Appeal review channel was not created",
      expect.objectContaining({
        extra: { appealId: 42, guildId: "guild-1" },
      }),
    );
    expect(
      context.databases.moderationDb.UpdateAppealReviewMessage,
    ).not.toHaveBeenCalled();
  });
});

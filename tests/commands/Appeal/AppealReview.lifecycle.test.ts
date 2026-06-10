import { describe, expect, it, vi } from "vitest";
import type { ButtonInteraction, Guild } from "discord.js";
import { HandleAppealDecisionButton } from "@commands/Moderation/Appeal/AppealReviewResolveFlow";
import { createMockContext } from "../../helpers";

describe("Appeal review button lifecycle", () => {
  it("registers modal and shows it for approve decision", async () => {
    const showModal = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      id: "999888777666555444",
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      user: { id: "mod-1" },
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      },
      showModal,
    } as unknown as ButtonInteraction;

    const context = createMockContext();
    (
      context.databases.moderationDb.GetAppealById as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 12,
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "warning",
      action_ref: "5",
      reason: "reason",
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

    await HandleAppealDecisionButton(interaction, context, 12, "approved");

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(context.responders.modalRouter.RegisterModal).toHaveBeenCalledWith(
      expect.objectContaining({
        customId: expect.stringContaining("appeal-review:"),
        singleUse: true,
      }),
    );
  });

  it("replies with permission error for non-reviewer", async () => {
    const interaction = {
      id: "111222333444555666",
      guild: { id: "guild-1" } as unknown as Guild,
      user: { id: "user-1" },
      member: {
        permissions: { has: vi.fn().mockReturnValue(false) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      },
      showModal: vi.fn(),
    } as unknown as ButtonInteraction;

    const context = createMockContext();
    await HandleAppealDecisionButton(interaction, context, 12, "denied");

    expect(interaction.showModal).not.toHaveBeenCalled();
    expect(context.responders.buttonResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        content: expect.stringContaining("permission"),
      }),
    );
  });

  it("modal handler finalizes denied appeal", async () => {
    const showModal = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      id: "modal-flow-id",
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      user: { id: "mod-1" },
      member: {
        permissions: { has: vi.fn().mockReturnValue(true) },
        roles: { cache: { some: vi.fn().mockReturnValue(false) } },
      },
      showModal,
    } as unknown as ButtonInteraction;

    const context = createMockContext();
    (
      context.databases.moderationDb.GetAppealById as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 15,
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "ban",
      action_ref: "2",
      reason: "reason",
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
    (
      context.databases.moderationDb.ResolveAppeal as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 15,
      guild_id: "guild-1",
      user_id: "user-1",
      action_type: "ban",
      action_ref: "2",
      reason: "reason",
      evidence: null,
      status: "denied",
      review_channel_id: null,
      review_message_id: null,
      resolved_by: "mod-1",
      resolved_reason: "Denied by staff",
      created_at: Date.now(),
      updated_at: Date.now(),
      resolved_at: Date.now(),
    });

    await HandleAppealDecisionButton(interaction, context, 15, "denied");

    const modalRegistration = (
      context.responders.modalRouter.RegisterModal as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];

    const modalInteraction = {
      user: { id: "mod-1" },
      client: {
        guilds: {
          fetch: vi.fn().mockResolvedValue({ id: "guild-1", name: "Test Guild" }),
        },
        users: {
          fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockResolvedValue(undefined) }),
        },
      },
      fields: {
        getTextInputValue: vi.fn().mockReturnValue("Denied by staff"),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };

    await modalRegistration.handler(modalInteraction);

    expect(context.databases.moderationDb.ResolveAppeal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 15,
        status: "denied",
        resolved_by: "mod-1",
      }),
    );
    expect(modalInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("DENIED"),
      }),
    );
  });
});

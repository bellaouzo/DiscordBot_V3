import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MessageFlags,
  PermissionFlagsBits,
  type Guild,
  type TextChannel,
} from "discord.js";
import { createMockContext, createMockInteraction } from "../../helpers";
import {
  HandlePanel,
  RegisterAppealPanelButton,
} from "@commands/Moderation/Appeal/AppealPanelFlow";
import { BeginAppealSubmission } from "@commands/Moderation/Appeal/AppealSubmitFlow";
import { ResolveInteractionMember } from "@utilities/GuildMemberResolver";

vi.mock("@utilities/GuildMemberResolver", () => ({
  ResolveInteractionMember: vi.fn(),
}));

vi.mock("@commands/Moderation/Appeal/AppealSubmitFlow", () => ({
  BeginAppealSubmission: vi.fn().mockResolvedValue(undefined),
}));

describe("Appeal panel lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts appeal panel for reviewers in text channels", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = {
      isTextBased: () => true,
      isDMBased: () => false,
      send,
    };
    const interaction = {
      ...createMockInteraction({
        guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
        member: {
          permissions: { has: vi.fn().mockReturnValue(true) },
          roles: { cache: { some: vi.fn().mockReturnValue(false) } },
        } as never,
      }),
      channel: channel as unknown as TextChannel,
    };
    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: ["mod-role"],
    });

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: {
        has: vi.fn((flag) => flag === PermissionFlagsBits.BanMembers),
      },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    await HandlePanel(interaction, context);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Moderation Appeals" }),
        ]),
        components: expect.any(Array),
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Appeal Panel Posted" }),
        ]),
      }),
    );
  });

  it("denies panel posting for non-reviewers", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      channel: {
        isTextBased: () => true,
        isDMBased: () => false,
        send: vi.fn(),
      } as never,
    });
    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: { has: vi.fn().mockReturnValue(false) },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    await HandlePanel(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Permission Denied" }),
        ]),
      }),
    );
  });

  it("rejects panel posting without a guild", async () => {
    const interaction = createMockInteraction({
      guild: null,
      channel: {
        isTextBased: () => true,
        isDMBased: () => false,
        send: vi.fn(),
      } as never,
    });
    const context = createMockContext();

    await HandlePanel(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Guild Only" }),
        ]),
      }),
    );
  });

  it("rejects panel posting in non-text channels", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      channel: {
        isTextBased: () => false,
        isDMBased: () => false,
        send: vi.fn(),
      } as never,
    });
    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: [],
    });

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: {
        has: vi.fn((flag) => flag === PermissionFlagsBits.BanMembers),
      },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    await HandlePanel(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Invalid Channel" }),
        ]),
      }),
    );
  });

  it("registers panel button and rejects submissions without guild", async () => {
    const context = createMockContext();
    const registerButton = vi.fn();
    context.responders.componentRouter.RegisterButton = registerButton;
    context.responders.buttonResponder.Reply = vi
      .fn()
      .mockResolvedValue({ success: true });
    context.responders.interactionResponder.Defer = vi
      .fn()
      .mockResolvedValue({ success: true });

    RegisterAppealPanelButton(context);

    expect(registerButton).toHaveBeenCalledWith(
      expect.objectContaining({ customId: "appeal-panel:submit" }),
    );

    const registration = registerButton.mock.calls[0][0];
    const buttonInteraction = {
      guild: null,
      user: { id: "user-1" },
    };

    await registration.handler(buttonInteraction);

    expect(context.responders.buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        content: "Appeals can only be submitted inside a server.",
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it("begins appeal submission when panel button defer succeeds", async () => {
    const context = createMockContext();
    const registerButton = vi.fn();
    context.responders.componentRouter.RegisterButton = registerButton;
    context.responders.interactionResponder.Defer = vi
      .fn()
      .mockResolvedValue({ success: true });

    RegisterAppealPanelButton(context);

    const registration = registerButton.mock.calls[0][0];
    const buttonInteraction = {
      guild: { id: "guild-1" },
      user: { id: "user-1" },
    };

    await registration.handler(buttonInteraction);

    expect(BeginAppealSubmission).toHaveBeenCalledWith({
      interaction: buttonInteraction,
      context,
      guild: buttonInteraction.guild,
    });
  });

  it("returns early when panel button defer fails", async () => {
    const context = createMockContext();
    const registerButton = vi.fn();
    context.responders.componentRouter.RegisterButton = registerButton;
    context.responders.interactionResponder.Defer = vi
      .fn()
      .mockResolvedValue({ success: false });

    RegisterAppealPanelButton(context);

    const registration = registerButton.mock.calls[0][0];
    await registration.handler({
      guild: { id: "guild-1" },
      user: { id: "user-1" },
    });

    expect(BeginAppealSubmission).not.toHaveBeenCalled();
  });
});

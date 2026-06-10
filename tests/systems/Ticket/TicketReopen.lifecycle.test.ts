import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MessageFlags,
  PermissionFlagsBits,
  EmbedBuilder,
  type Guild,
} from "discord.js";
import {
  createMockContext,
  createMockInteraction,
  stubInteractionOptions,
} from "../../helpers";
import { HandleTicketReopen } from "@systems/Ticket/handlers/ReopenHandler";
import { CreateTicketServices } from "@systems/Ticket/validation/TicketValidation";
import { ResolveInteractionMember } from "@utilities/GuildMemberResolver";

vi.mock(
  "@systems/Ticket/validation/TicketValidation",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@systems/Ticket/validation/TicketValidation")
      >();
    return {
      ...actual,
      CreateTicketServices: vi.fn(),
    };
  },
);

vi.mock("@utilities/GuildMemberResolver", () => ({
  ResolveInteractionMember: vi.fn(),
}));

describe("Ticket reopen lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles reopen interaction lifecycle from select to modal completion", async () => {
    const guild = {
      id: "guild-1",
      name: "Test Guild",
    } as unknown as Guild;

    const interaction = createMockInteraction({
      id: "interaction-reopen-1",
      guild,
      user: { id: "mod-1", username: "ModOne" } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "reopen",
    });

    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: ["mod-role"],
      ticket_category_id: "category-1",
    });
    (
      context.databases.ticketDb.GetGuildTickets as ReturnType<typeof vi.fn>
    ).mockReturnValue([
      {
        id: 4,
        user_id: "user-1",
        guild_id: "guild-1",
        channel_id: "channel-4",
        category: "general",
        status: "closed",
        claimed_by: null,
        created_at: Date.now() - 10_000,
        closed_at: Date.now() - 1_000,
      },
    ]);
    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 4,
      user_id: "user-1",
      guild_id: "guild-1",
      channel_id: "channel-4",
      category: "general",
      status: "closed",
      claimed_by: null,
      created_at: Date.now() - 10_000,
      closed_at: Date.now() - 1_000,
    });
    (
      context.databases.ticketDb.GetTicketMessages as ReturnType<typeof vi.fn>
    ).mockReturnValue([]);
    (
      context.databases.ticketDb.GetParticipantHistory as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([]);

    const reopenedTicket = {
      id: 9,
      user_id: "user-1",
      guild_id: "guild-1",
      channel_id: "channel-9",
      category: "general",
      status: "open" as const,
      claimed_by: null,
      created_at: Date.now(),
      closed_at: null,
    };
    const channelSend = vi.fn().mockResolvedValue(undefined);
    const reopenTicket = vi.fn().mockResolvedValue({
      ticket: reopenedTicket,
      channel: {
        id: "channel-9",
        send: channelSend,
      },
    });

    vi.mocked(CreateTicketServices).mockReturnValue({
      ticketDb: context.databases.ticketDb,
      ticketManager: { ReopenTicket: reopenTicket } as never,
      ticketPresentation: {
        CreateTicketEmbed: vi
          .fn()
          .mockReturnValue(new EmbedBuilder({ title: "🎫 Ticket #9" })),
        CreateTicketButtons: vi.fn().mockReturnValue({
          toJSON: () => ({}),
        }),
      } as never,
      ticketLogService: {
        GetOrCreateTicketLogsChannel: vi.fn().mockResolvedValue(null),
      } as never,
      guildResourceLocator: {
        GetMember: vi.fn().mockResolvedValue({
          user: { id: "user-1", username: "UserOne", tag: "UserOne#0001" },
        }),
      } as never,
      settings: null,
      staffRoleIds: [],
    });

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: {
        has: vi
          .fn()
          .mockImplementation(
            (flag) => flag === PermissionFlagsBits.ManageGuild,
          ),
      },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    await HandleTicketReopen(interaction, context);

    expect(context.responders.interactionResponder.Defer).toHaveBeenCalledWith(
      interaction,
      true,
    );
    expect(
      context.responders.selectMenuRouter.RegisterSelectMenu,
    ).toHaveBeenCalledTimes(1);

    const selectRegistration = (
      context.responders.selectMenuRouter.RegisterSelectMenu as ReturnType<
        typeof vi.fn
      >
    ).mock.calls[0][0];
    const selectInteraction = {
      id: "select-reopen-1",
      values: ["4"],
      user: { id: "mod-1" },
      showModal: vi.fn().mockResolvedValue(undefined),
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
      user: { id: "mod-1" },
      guild,
      fields: {
        getTextInputValue: vi
          .fn()
          .mockImplementation((field: string) =>
            field === "reason" ? "Issue not fully resolved" : "",
          ),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      client: {
        users: {
          fetch: vi.fn().mockResolvedValue({
            id: "user-1",
            username: "UserOne",
            tag: "UserOne#0001",
          }),
        },
      },
    };
    await modalRegistration.handler(modalInteraction);

    expect(modalInteraction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(reopenTicket).toHaveBeenCalledWith({
      priorTicketId: 4,
      reopenedBy: "mod-1",
      reason: "Issue not fully resolved",
    });
    expect(channelSend).toHaveBeenCalledTimes(1);
    expect(modalInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Ticket Reopened"),
          }),
        ]),
      }),
    );
  });

  it("replies with permission denied for non-staff members", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      user: { id: "user-1", username: "UserOne" } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "reopen",
    });

    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: { has: vi.fn().mockReturnValue(false) },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    await HandleTicketReopen(interaction, context);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Permission Denied",
          }),
        ]),
      }),
    );
    expect(
      context.responders.interactionResponder.Defer,
    ).not.toHaveBeenCalled();
  });

  it("edits with no closed tickets warning when queue is empty", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1", name: "Test Guild" } as unknown as Guild,
      user: { id: "mod-1", username: "ModOne" } as never,
    });
    stubInteractionOptions(interaction, {
      getSubcommand: () => "reopen",
    });

    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);
    (
      context.databases.ticketDb.GetGuildTickets as ReturnType<typeof vi.fn>
    ).mockReturnValue([]);

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: {
        has: vi
          .fn()
          .mockImplementation(
            (flag) => flag === PermissionFlagsBits.ManageGuild,
          ),
      },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    await HandleTicketReopen(interaction, context);

    expect(context.responders.interactionResponder.Defer).toHaveBeenCalledWith(
      interaction,
      true,
    );
    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "No Closed Tickets",
          }),
        ]),
      }),
    );
  });
});

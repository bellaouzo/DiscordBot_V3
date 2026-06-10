import { describe, expect, it, vi, beforeEach } from "vitest";
import { type Guild } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { createMockContext, createMockInteraction } from "../../helpers";
import { HandleTicketCreate } from "@systems/Ticket/handlers/CreateHandler";
import { CreateTicketServices } from "@systems/Ticket/validation/TicketValidation";

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

describe("Ticket open lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles create interaction lifecycle from defer to ticket channel creation", async () => {
    const guild = {
      id: "guild-1",
      name: "Test Guild",
    } as unknown as Guild;

    const interaction = createMockInteraction({
      id: "interaction-open-1",
      guild,
      user: { id: "user-1", username: "UserOne" } as never,
    });

    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      ticket_category_id: "category-1",
    });
    (
      context.databases.ticketDb.GetActiveUserTickets as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([]);
    (
      context.databases.ticketDb.EnsureCategoryConfigs as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([
      {
        id: 1,
        guild_id: "guild-1",
        value: "general",
        label: "General Support",
        description: "General questions",
        emoji: "💬",
        sort_order: 0,
      },
    ]);

    const createdTicket = {
      id: 7,
      user_id: "user-1",
      guild_id: "guild-1",
      channel_id: "channel-7",
      category: "general",
      status: "open" as const,
      claimed_by: null,
      created_at: Date.now(),
      closed_at: null,
    };
    const channelSend = vi.fn().mockResolvedValue(undefined);
    const mockTicketManager = {
      CreateTicket: vi.fn().mockResolvedValue({
        ticket: createdTicket,
        channel: {
          id: "channel-7",
          send: channelSend,
        },
      }),
    };
    const mockTicketPresentation = {
      CreateTicketEmbed: vi
        .fn()
        .mockReturnValue(new EmbedBuilder({ title: "🎫 Ticket #7" })),
      CreateTicketButtons: vi.fn().mockReturnValue({
        toJSON: () => ({}),
      }),
    };

    vi.mocked(CreateTicketServices).mockReturnValue({
      ticketDb: context.databases.ticketDb,
      ticketManager: mockTicketManager as never,
      ticketPresentation: mockTicketPresentation as never,
      ticketLogService: { GetOrCreateTicketLogsChannel: vi.fn() } as never,
      guildResourceLocator: { GetMember: vi.fn() } as never,
      settings: null,
      staffRoleIds: [],
    });

    await HandleTicketCreate(interaction, context);

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
      values: ["general"],
      user: { id: "user-1", username: "UserOne" },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    await selectRegistration.handler(selectInteraction);

    expect(mockTicketManager.CreateTicket).toHaveBeenCalledWith({
      userId: "user-1",
      category: "general",
    });
    expect(channelSend).toHaveBeenCalledTimes(1);
    expect(selectInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Ticket Created"),
          }),
        ]),
      }),
    );
  });

  it("replies with already-open warning when user has an active ticket", async () => {
    const guild = {
      id: "guild-1",
      name: "Test Guild",
    } as unknown as Guild;

    const interaction = createMockInteraction({
      guild,
      user: { id: "user-1", username: "UserOne" } as never,
    });

    const context = createMockContext();
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);
    (
      context.databases.ticketDb.GetActiveUserTickets as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([
      {
        id: 3,
        user_id: "user-1",
        guild_id: "guild-1",
        channel_id: "channel-3",
        category: "general",
        status: "open",
        claimed_by: null,
        created_at: Date.now(),
        closed_at: null,
      },
    ]);

    vi.mocked(CreateTicketServices).mockReturnValue({
      ticketDb: context.databases.ticketDb,
      ticketManager: { CreateTicket: vi.fn() } as never,
      ticketPresentation: {} as never,
      ticketLogService: {} as never,
      guildResourceLocator: {} as never,
      settings: null,
      staffRoleIds: [],
    });

    await HandleTicketCreate(interaction, context);

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Ticket Already Open",
          }),
        ]),
      }),
    );
    expect(
      context.responders.selectMenuRouter.RegisterSelectMenu,
    ).not.toHaveBeenCalled();
  });
});

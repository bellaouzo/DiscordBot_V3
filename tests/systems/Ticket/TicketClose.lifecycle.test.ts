import { describe, expect, it, vi, beforeEach } from "vitest";
import { MessageFlags, PermissionFlagsBits, type Guild } from "discord.js";
import { createMockContext, createMockLogger } from "../../helpers";
import { HandleCloseButton } from "@systems/Ticket/buttons/CloseButton";
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

describe("Ticket close lifecycle", () => {
  const openTicket = {
    id: 12,
    user_id: "user-1",
    guild_id: "guild-1",
    channel_id: "channel-12",
    category: "general",
    status: "open" as const,
    claimed_by: null,
    created_at: Date.now(),
    closed_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createButtonResponder() {
    return {
      Reply: vi.fn().mockResolvedValue({ success: true }),
      DeferUpdate: vi.fn().mockResolvedValue({ success: true }),
      EditMessage: vi.fn().mockResolvedValue({ success: true }),
      Register: vi.fn(),
      Handle: vi.fn(),
    };
  }

  it("closes an open ticket for the ticket owner", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(openTicket);
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: ["mod-role"],
    });
    (
      context.databases.ticketDb.GetTicketMessages as ReturnType<typeof vi.fn>
    ).mockReturnValue([]);
    (
      context.databases.ticketDb.GetParticipantHistory as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([]);

    const closeTicket = vi.fn().mockResolvedValue(undefined);
    vi.mocked(CreateTicketServices).mockReturnValue({
      ticketDb: context.databases.ticketDb,
      ticketManager: { CloseTicket: closeTicket } as never,
      ticketPresentation: {} as never,
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
      permissions: { has: vi.fn().mockReturnValue(false) },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    const buttonResponder = createButtonResponder();
    const buttonInteraction = {
      customId: "ticket:close:12",
      user: { id: "user-1" },
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

    await HandleCloseButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      databases: context.databases,
      logger,
      guild,
    });

    expect(buttonResponder.DeferUpdate).toHaveBeenCalledWith(buttonInteraction);
    expect(buttonResponder.EditMessage).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        components: [],
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Ticket Closed"),
          }),
        ]),
      }),
    );
    expect(closeTicket).toHaveBeenCalledWith(12, "user-1", false);
  });

  it("replies with permission denied for non-owner non-staff", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(openTicket);
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: { has: vi.fn().mockReturnValue(false) },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    const buttonResponder = createButtonResponder();
    const buttonInteraction = {
      customId: "ticket:close:12",
      user: { id: "user-9" },
    };

    await HandleCloseButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      databases: context.databases,
      logger,
      guild,
    });

    expect(buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Permission Denied",
          }),
        ]),
      }),
    );
    expect(buttonResponder.DeferUpdate).not.toHaveBeenCalled();
  });

  it("allows staff with manage guild permission to close tickets", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(openTicket);
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);
    (
      context.databases.ticketDb.GetTicketMessages as ReturnType<typeof vi.fn>
    ).mockReturnValue([]);
    (
      context.databases.ticketDb.GetParticipantHistory as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([]);

    const closeTicket = vi.fn().mockResolvedValue(undefined);
    vi.mocked(CreateTicketServices).mockReturnValue({
      ticketDb: context.databases.ticketDb,
      ticketManager: { CloseTicket: closeTicket } as never,
      ticketPresentation: {} as never,
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

    const buttonResponder = createButtonResponder();
    const buttonInteraction = {
      customId: "ticket:close:12",
      user: { id: "mod-1" },
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

    await HandleCloseButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      databases: context.databases,
      logger,
      guild,
    });

    expect(closeTicket).toHaveBeenCalledWith(12, "mod-1", false);
  });

  it("replies when ticket is already closed", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      ...openTicket,
      status: "closed",
      closed_at: Date.now(),
    });

    const buttonResponder = createButtonResponder();
    const buttonInteraction = {
      customId: "ticket:close:12",
      user: { id: "user-1" },
    };

    await HandleCloseButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      databases: context.databases,
      logger,
      guild,
    });

    expect(buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: "Ticket Unavailable",
          }),
        ]),
      }),
    );
  });
});

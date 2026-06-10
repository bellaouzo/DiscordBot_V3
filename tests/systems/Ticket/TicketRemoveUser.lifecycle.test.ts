import { describe, expect, it, vi, beforeEach } from "vitest";
import { MessageFlags, type Guild } from "discord.js";
import { createMockContext, createMockLogger } from "../../helpers";
import { HandleRemoveUserButton } from "@systems/Ticket/buttons/RemoveUserButton";
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

describe("Ticket remove user lifecycle", () => {
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

  it("warns when there are no removable participants", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(openTicket);
    (
      context.databases.ticketDb.GetActiveParticipants as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([{ user_id: "user-1" }]);

    vi.mocked(CreateTicketServices).mockReturnValue({
      guildResourceLocator: {
        GetMember: vi.fn().mockResolvedValue({
          permissions: { has: vi.fn().mockReturnValue(true) },
          roles: { cache: { some: vi.fn().mockReturnValue(false) } },
        }),
      },
      settings: null,
    } as never);

    const buttonResponder = {
      Reply: vi.fn().mockResolvedValue({ success: true }),
      DeferUpdate: vi.fn(),
      FollowUp: vi.fn(),
    };
    const buttonInteraction = {
      customId: "ticket:remove:12",
      id: "interaction-remove",
      user: { id: "staff-1" },
    };

    await HandleRemoveUserButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      userSelectMenuRouter: { RegisterUserSelectMenu: vi.fn() } as never,
      databases: context.databases,
      logger,
      guild,
    });

    expect(buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "No Participants" }),
        ]),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it("registers remove user select menu when participants exist", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(openTicket);
    (
      context.databases.ticketDb.GetActiveParticipants as ReturnType<
        typeof vi.fn
      >
    ).mockReturnValue([
      { user_id: "user-1" },
      { user_id: "user-2" },
    ]);

    vi.mocked(CreateTicketServices).mockReturnValue({
      guildResourceLocator: {
        GetMember: vi.fn().mockResolvedValue({
          permissions: { has: vi.fn().mockReturnValue(true) },
          roles: { cache: { some: vi.fn().mockReturnValue(false) } },
        }),
      },
      settings: null,
    } as never);

    const buttonResponder = {
      Reply: vi.fn().mockResolvedValue({ success: true }),
      DeferUpdate: vi.fn().mockResolvedValue({ success: true }),
      FollowUp: vi.fn().mockResolvedValue({ success: true }),
    };
    const userSelectMenuRouter = {
      RegisterUserSelectMenu: vi.fn(),
    };
    const buttonInteraction = {
      customId: "ticket:remove:12",
      id: "interaction-remove",
      user: { id: "staff-1" },
    };

    await HandleRemoveUserButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      userSelectMenuRouter: userSelectMenuRouter as never,
      databases: context.databases,
      logger,
      guild,
    });

    expect(buttonResponder.DeferUpdate).toHaveBeenCalled();
    expect(userSelectMenuRouter.RegisterUserSelectMenu).toHaveBeenCalled();
    expect(buttonResponder.FollowUp).toHaveBeenCalled();
  });
});

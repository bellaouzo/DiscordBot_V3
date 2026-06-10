import { describe, expect, it, vi, beforeEach } from "vitest";
import { MessageFlags, type Guild } from "discord.js";
import { createMockContext, createMockLogger } from "../../helpers";
import { HandleAddUserButton } from "@systems/Ticket/buttons/AddUserButton";
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

describe("Ticket add user lifecycle", () => {
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

  it("registers user select menu for authorized users", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(openTicket);

    vi.mocked(CreateTicketServices).mockReturnValue({
      guildResourceLocator: {
        GetMember: vi.fn().mockResolvedValue({
          permissions: { has: vi.fn().mockReturnValue(true) },
          roles: { cache: { some: vi.fn().mockReturnValue(false) } },
        }),
      },
      settings: {
        admin_role_ids: ["admin-role"],
        mod_role_ids: ["mod-role"],
      },
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
      customId: "ticket:add:12",
      id: "interaction-add",
      user: { id: "staff-1" },
    };

    await HandleAddUserButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      userSelectMenuRouter: userSelectMenuRouter as never,
      databases: context.databases,
      logger,
      guild,
    });

    expect(buttonResponder.DeferUpdate).toHaveBeenCalled();
    expect(userSelectMenuRouter.RegisterUserSelectMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        customId: "ticket-add-button:interaction-add",
        ownerId: "staff-1",
      }),
    );
    expect(buttonResponder.FollowUp).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
  });

  it("denies add user for unauthorized members", async () => {
    const context = createMockContext();
    const logger = createMockLogger();
    const guild = { id: "guild-1", name: "Test Guild" } as unknown as Guild;

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(openTicket);

    vi.mocked(CreateTicketServices).mockReturnValue({
      guildResourceLocator: {
        GetMember: vi.fn().mockResolvedValue({
          permissions: { has: vi.fn().mockReturnValue(false) },
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
      customId: "ticket:add:12",
      id: "interaction-add",
      user: { id: "user-2" },
    };

    await HandleAddUserButton(buttonInteraction as never, {
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
          expect.objectContaining({ title: "Permission Denied" }),
        ]),
      }),
    );
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { createMockContext, createMockLogger } from "../../helpers";
import { HandleClaimButton } from "@systems/Ticket/buttons/ClaimButton";
import { ResolveInteractionMember } from "@utilities/GuildMemberResolver";

vi.mock("@utilities/GuildMemberResolver", () => ({
  ResolveInteractionMember: vi.fn(),
}));

describe("Ticket claim lifecycle", () => {
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
    };
  }

  it("claims an open ticket for staff", async () => {
    const context = createMockContext();
    const logger = createMockLogger();

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

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: {
        has: vi.fn((flag) => flag === PermissionFlagsBits.BanMembers),
      },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    const buttonResponder = createButtonResponder();
    const buttonInteraction = {
      customId: "ticket:claim:12",
      user: { id: "staff-1" },
      guild: { id: "guild-1" },
    };

    await HandleClaimButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      ticketDb: context.databases.ticketDb,
      logger,
      databases: context.databases,
    });

    expect(buttonResponder.DeferUpdate).toHaveBeenCalled();
    expect(context.databases.ticketDb.UpdateTicketStatus).toHaveBeenCalledWith(
      12,
      "claimed",
      "staff-1",
    );
    expect(buttonResponder.EditMessage).toHaveBeenCalled();
  });

  it("denies claim for non-staff members", async () => {
    const context = createMockContext();
    const logger = createMockLogger();

    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      guild_id: "guild-1",
      admin_role_ids: ["admin-role"],
      mod_role_ids: ["mod-role"],
    });

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: { has: vi.fn().mockReturnValue(false) },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    const buttonResponder = createButtonResponder();
    const buttonInteraction = {
      customId: "ticket:claim:12",
      user: { id: "user-2" },
      guild: { id: "guild-1" },
    };

    await HandleClaimButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      ticketDb: context.databases.ticketDb,
      logger,
      databases: context.databases,
    });

    expect(buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
    expect(
      context.databases.ticketDb.UpdateTicketStatus,
    ).not.toHaveBeenCalled();
  });

  it("replies when ticket is closed or missing", async () => {
    const context = createMockContext();
    const logger = createMockLogger();

    (
      context.databases.ticketDb.GetTicket as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);

    vi.mocked(ResolveInteractionMember).mockResolvedValue({
      permissions: { has: vi.fn().mockReturnValue(true) },
      roles: { cache: { some: vi.fn().mockReturnValue(false) } },
    } as never);

    const buttonResponder = createButtonResponder();
    const buttonInteraction = {
      customId: "ticket:claim:12",
      user: { id: "staff-1" },
      guild: { id: "guild-1" },
    };

    await HandleClaimButton(buttonInteraction as never, {
      buttonResponder: buttonResponder as never,
      ticketDb: context.databases.ticketDb,
      logger,
      databases: context.databases,
    });

    expect(buttonResponder.Reply).toHaveBeenCalledWith(
      buttonInteraction,
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: "Ticket Unavailable" }),
        ]),
      }),
    );
  });
});

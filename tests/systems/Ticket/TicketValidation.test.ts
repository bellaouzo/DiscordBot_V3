import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HasStaffPermissions,
  ValidateTicketChannel,
  ValidateGuildOrReply,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
} from "@systems/Ticket/validation/TicketValidation";
import {
  createMockInteraction,
  createMockContext,
  createMockDatabaseSet,
} from "../../helpers";

describe("TicketValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("HasStaffPermissions returns false when member is null", () => {
    expect(HasStaffPermissions(null as never)).toBe(false);
  });

  it("HasStaffPermissions returns false when permissions is string", () => {
    expect(HasStaffPermissions({ permissions: "8" } as never)).toBe(false);
  });

  it("HasStaffPermissions returns true when member has ManageGuild", () => {
    const member = {
      permissions: {
        has: vi.fn().mockReturnValue(true),
      },
    };
    expect(HasStaffPermissions(member as never)).toBe(true);
    expect(member.permissions.has).toHaveBeenCalledWith("ManageGuild");
  });

  it("HasStaffPermissions returns true when member has Administrator", () => {
    const member = {
      permissions: {
        has: vi.fn().mockImplementation((p: string) => p === "Administrator"),
      },
    };
    expect(HasStaffPermissions(member as never)).toBe(true);
  });

  it("HasStaffPermissions returns false when member has neither", () => {
    const member = {
      permissions: {
        has: vi.fn().mockReturnValue(false),
      },
    };
    expect(HasStaffPermissions(member as never)).toBe(false);
  });

  it("ValidateTicketChannel returns false when channel is null", () => {
    expect(ValidateTicketChannel(null as never)).toBe(false);
  });

  it("ValidateTicketChannel returns true when channel is text-based", () => {
    expect(ValidateTicketChannel({ isTextBased: () => true } as never)).toBe(
      true
    );
  });

  it("ValidateTicketChannel returns false when channel is not text-based", () => {
    expect(ValidateTicketChannel({ isTextBased: () => false } as never)).toBe(
      false
    );
  });

  it("ValidateGuildOrReply replies and returns false when no guild", async () => {
    const interaction = createMockInteraction({ guild: null });
    const context = createMockContext();
    const result = await ValidateGuildOrReply(
      interaction,
      context.responders.interactionResponder
    );
    expect(result).toBe(false);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      })
    );
  });

  it("ValidateGuildOrReply returns true when guild exists", async () => {
    const interaction = createMockInteraction({ guild: {} as never });
    const context = createMockContext();
    const result = await ValidateGuildOrReply(
      interaction,
      context.responders.interactionResponder
    );
    expect(result).toBe(true);
    expect(
      context.responders.interactionResponder.Reply
    ).not.toHaveBeenCalled();
  });

  it("ValidateTicketChannelOrReply replies and returns false when no guild", async () => {
    const interaction = createMockInteraction({ guild: null });
    const context = createMockContext();
    const result = await ValidateTicketChannelOrReply(
      interaction,
      context.responders.interactionResponder
    );
    expect(result).toBe(false);
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalled();
  });

  it("ValidateTicketChannelOrReply returns true when guild and channel valid", async () => {
    const interaction = createMockInteraction({
      guild: {} as never,
      options: undefined,
    });
    const channel = { isTextBased: () => true };
    const interactionWithChannel = {
      ...interaction,
      channel,
    } as never;
    const context = createMockContext();
    const result = await ValidateTicketChannelOrReply(
      interactionWithChannel,
      context.responders.interactionResponder
    );
    expect(result).toBe(true);
  });

  it("GetTicketOrReply returns ticket when found", async () => {
    const databases = createMockDatabaseSet();
    const ticket = {
      id: 1,
      guild_id: "g1",
      channel_id: "ch1",
      user_id: "u1",
      status: "open",
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    vi.mocked(databases.ticketDb.GetTicketByChannel).mockReturnValue(
      ticket as never
    );
    const interaction = createMockInteraction();
    const channel = { id: "ch1" } as never;
    const result = await GetTicketOrReply(
      databases.ticketDb,
      channel,
      interaction,
      createMockContext().responders.interactionResponder
    );
    expect(result).toEqual(ticket);
    expect(databases.ticketDb.GetTicketByChannel).toHaveBeenCalledWith("ch1");
  });

  it("GetTicketOrReply replies and returns null when ticket not found", async () => {
    const databases = createMockDatabaseSet();
    vi.mocked(databases.ticketDb.GetTicketByChannel).mockReturnValue(null);
    const context = createMockContext();
    const interaction = createMockInteraction();
    const channel = { id: "ch1" } as never;
    const result = await GetTicketOrReply(
      databases.ticketDb,
      channel,
      interaction,
      context.responders.interactionResponder
    );
    expect(result).toBeNull();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      })
    );
  });
});

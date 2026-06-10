import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TicketManager } from "@utilities/TicketManager";
import type { Ticket } from "@database/Ticket/Types";
import { createMockLogger } from "../helpers";

const mockGetOrCreateCategory = vi.fn();

vi.mock("@utilities/ChannelManager", () => ({
  CreateChannelManager: vi.fn(() => ({
    GetOrCreateCategory: mockGetOrCreateCategory,
    GetOrCreateTextChannel: vi.fn(),
  })),
}));

describe("TicketManager lifecycle", () => {
  const guildId = "guild-1";
  const userId = "user-1";
  const staffId = "staff-1";
  const categoryId = "category-1";

  let ticketDb: {
    CreateTicket: ReturnType<typeof vi.fn>;
    UpdateTicketChannelId: ReturnType<typeof vi.fn>;
    UpdateTicketStatus: ReturnType<typeof vi.fn>;
    GetTicket: ReturnType<typeof vi.fn>;
    CloseTicket: ReturnType<typeof vi.fn>;
    AddReopenAudit: ReturnType<typeof vi.fn>;
    AddParticipant: ReturnType<typeof vi.fn>;
    RemoveParticipant: ReturnType<typeof vi.fn>;
  };
  let guildResourceLocator: {
    GetMember: ReturnType<typeof vi.fn>;
    GetCategoryChannel: ReturnType<typeof vi.fn>;
  };
  let guild: Guild;
  let manager: TicketManager;

  const member = {
    id: userId,
    user: { id: userId, username: "TestUser" },
  } as unknown as GuildMember;

  const categoryChannel = {
    id: categoryId,
    type: ChannelType.GuildCategory,
  } as unknown as CategoryChannel;

  function buildOpenTicket(overrides: Partial<Ticket> = {}): Ticket {
    return {
      id: 1,
      user_id: userId,
      guild_id: guildId,
      channel_id: "channel-1",
      category: "general",
      status: "open",
      claimed_by: null,
      created_at: Date.now(),
      closed_at: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    ticketDb = {
      CreateTicket: vi.fn(),
      UpdateTicketChannelId: vi.fn(),
      UpdateTicketStatus: vi.fn(),
      GetTicket: vi.fn(),
      CloseTicket: vi.fn(),
      AddReopenAudit: vi.fn(),
      AddParticipant: vi.fn(),
      RemoveParticipant: vi.fn().mockReturnValue(true),
    };

    guildResourceLocator = {
      GetMember: vi.fn().mockResolvedValue(member),
      GetCategoryChannel: vi.fn().mockResolvedValue(categoryChannel),
    };

    const channelCreate = vi.fn().mockImplementation(async (options) => ({
      id: "channel-new",
      type: ChannelType.GuildText,
      ...options,
    }));

    guild = {
      id: guildId,
      channels: {
        create: channelCreate,
        fetch: vi.fn(),
      },
      members: {
        fetchMe: vi.fn().mockResolvedValue({ id: "bot-1" }),
      },
    } as unknown as Guild;

    mockGetOrCreateCategory.mockResolvedValue(categoryChannel);

    manager = new TicketManager({
      guild,
      logger: createMockLogger(),
      ticketDb: ticketDb as never,
      guildResourceLocator: guildResourceLocator as never,
      ticketCategoryId: categoryId,
      staffRoleIds: ["role-staff"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("CreateTicket", () => {
    it("throws when member is missing", async () => {
      guildResourceLocator.GetMember.mockResolvedValue(null);
      await expect(
        manager.CreateTicket({ userId, category: "general" }),
      ).rejects.toThrow(`User ${userId} not found in guild ${guildId}`);
    });

    it("throws when ticket category cannot be resolved", async () => {
      guildResourceLocator.GetCategoryChannel.mockResolvedValue(null);
      mockGetOrCreateCategory.mockResolvedValue(null);
      await expect(
        manager.CreateTicket({ userId, category: "general" }),
      ).rejects.toThrow("Unable to resolve ticket category");
    });

    it("creates ticket row, channel, and updates status to open", async () => {
      const createdTicket = buildOpenTicket({
        id: 5,
        channel_id: null,
        status: "open",
      });
      ticketDb.CreateTicket.mockReturnValue(createdTicket);

      const result = await manager.CreateTicket({
        userId,
        category: "general",
      });

      expect(ticketDb.CreateTicket).toHaveBeenCalledWith({
        user_id: userId,
        guild_id: guildId,
        channel_id: null,
        category: "general",
      });
      expect(guild.channels.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ticket-0005-TestUser",
          type: ChannelType.GuildText,
          parent: expect.objectContaining({ id: categoryId }),
          permissionOverwrites: expect.any(Array),
        }),
      );

      const overwrites = (guild.channels.create as ReturnType<typeof vi.fn>)
        .mock.calls[0][0].permissionOverwrites;
      expect(overwrites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: guildId,
            deny: [PermissionFlagsBits.ViewChannel],
          }),
          expect.objectContaining({
            id: userId,
            allow: expect.arrayContaining([
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ]),
          }),
          expect.objectContaining({ id: "role-staff" }),
          expect.objectContaining({ id: "bot-1" }),
        ]),
      );

      expect(ticketDb.UpdateTicketChannelId).toHaveBeenCalledWith(
        5,
        "channel-new",
      );
      expect(ticketDb.UpdateTicketStatus).toHaveBeenCalledWith(5, "open");
      expect(result.channel.id).toBe("channel-new");
    });
  });

  describe("ReopenTicket", () => {
    it("throws when prior ticket is not closed", async () => {
      ticketDb.GetTicket.mockReturnValue(buildOpenTicket({ status: "open" }));
      await expect(
        manager.ReopenTicket({
          priorTicketId: 1,
          reopenedBy: staffId,
        }),
      ).rejects.toThrow("Ticket must be closed before reopening");
    });

    it("creates new ticket, channel, and reopen audit row", async () => {
      const closedTicket = buildOpenTicket({
        id: 2,
        status: "closed",
        channel_id: "old-channel",
        closed_at: Date.now(),
      });
      const newTicket = buildOpenTicket({
        id: 3,
        channel_id: null,
        status: "open",
      });
      ticketDb.GetTicket.mockReturnValue(closedTicket);
      ticketDb.CreateTicket.mockReturnValue(newTicket);

      const result = await manager.ReopenTicket({
        priorTicketId: 2,
        reopenedBy: staffId,
        reason: "needs follow-up",
        transcriptUrl: "https://example.com/t/2",
      });

      expect(ticketDb.CreateTicket).toHaveBeenCalledWith({
        user_id: userId,
        guild_id: guildId,
        channel_id: null,
        category: "general",
      });
      expect(ticketDb.UpdateTicketChannelId).toHaveBeenCalledWith(
        3,
        "channel-new",
      );
      expect(ticketDb.UpdateTicketStatus).toHaveBeenCalledWith(3, "open");
      expect(ticketDb.AddReopenAudit).toHaveBeenCalledWith({
        prior_ticket_id: 2,
        new_ticket_id: 3,
        guild_id: guildId,
        reopened_by: staffId,
        reason: "needs follow-up",
        prior_status: "closed",
        transcript_url: "https://example.com/t/2",
      });
      expect(result.ticket.id).toBe(3);
    });
  });

  describe("CloseTicket", () => {
    it("closes ticket in database and sends pre-delete embed", async () => {
      vi.useFakeTimers();
      const ticket = buildOpenTicket({ id: 4 });
      ticketDb.GetTicket.mockReturnValue(ticket);
      ticketDb.CloseTicket.mockReturnValue(true);

      const channelSend = vi.fn().mockResolvedValue(undefined);
      const channelDelete = vi.fn().mockResolvedValue(undefined);
      const channel = {
        id: "channel-1",
        isTextBased: () => true,
        type: ChannelType.GuildText,
        send: channelSend,
        delete: channelDelete,
      } as unknown as TextChannel;

      vi.mocked(guild.channels.fetch).mockResolvedValue(channel);

      const closed = await manager.CloseTicket(4, staffId, true);
      expect(closed).toBe(true);
      expect(ticketDb.CloseTicket).toHaveBeenCalledWith(4, staffId);
      expect(channelSend).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) }),
      );

      await vi.advanceTimersByTimeAsync(10_000);
      expect(channelDelete).toHaveBeenCalledWith("Ticket closed (auto-delete)");
    });

    it("returns false when ticket is missing", async () => {
      ticketDb.GetTicket.mockReturnValue(null);
      const closed = await manager.CloseTicket(99);
      expect(closed).toBe(false);
    });
  });

  describe("AddUserToTicket", () => {
    it("returns false when ticket channel is missing", async () => {
      ticketDb.GetTicket.mockReturnValue(buildOpenTicket({ channel_id: null }));
      const added = await manager.AddUserToTicket(1, "user-2", staffId);
      expect(added).toBe(false);
    });

    it("adds permission overwrite and participant when member exists", async () => {
      const ticket = buildOpenTicket({ id: 6 });
      ticketDb.GetTicket.mockReturnValue(ticket);

      const permissionCreate = vi.fn().mockResolvedValue(undefined);
      const addedMember = {
        id: "user-2",
        user: { id: "user-2", username: "AddedUser" },
      } as unknown as GuildMember;
      guildResourceLocator.GetMember.mockImplementation(async (id: string) => {
        if (id === "user-2") return addedMember;
        if (id === userId) return member;
        return null;
      });

      const channel = {
        id: "channel-1",
        isTextBased: () => true,
        type: ChannelType.GuildText,
        permissionOverwrites: { create: permissionCreate },
      } as unknown as TextChannel;
      vi.mocked(guild.channels.fetch).mockResolvedValue(channel);

      const added = await manager.AddUserToTicket(6, "user-2", staffId);
      expect(added).toBe(true);
      expect(permissionCreate).toHaveBeenCalledWith(addedMember, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      expect(ticketDb.AddParticipant).toHaveBeenCalledWith(
        6,
        "user-2",
        staffId,
      );
    });

    it("returns false when member to add is missing", async () => {
      ticketDb.GetTicket.mockReturnValue(buildOpenTicket({ id: 7 }));
      const channel = {
        id: "channel-1",
        isTextBased: () => true,
        type: ChannelType.GuildText,
        permissionOverwrites: { create: vi.fn() },
      } as unknown as TextChannel;
      vi.mocked(guild.channels.fetch).mockResolvedValue(channel);
      guildResourceLocator.GetMember.mockResolvedValue(null);

      const added = await manager.AddUserToTicket(7, "missing-user", staffId);
      expect(added).toBe(false);
    });
  });

  describe("RemoveUserFromTicket", () => {
    it("returns false when removing ticket owner", async () => {
      ticketDb.GetTicket.mockReturnValue(buildOpenTicket({ id: 8 }));
      const removed = await manager.RemoveUserFromTicket(8, userId, staffId);
      expect(removed).toBe(false);
    });

    it("removes permission overwrite and participant", async () => {
      const ticket = buildOpenTicket({ id: 9 });
      ticketDb.GetTicket.mockReturnValue(ticket);

      const removedMember = {
        id: "user-2",
        user: { id: "user-2", username: "RemovedUser" },
      } as unknown as GuildMember;
      guildResourceLocator.GetMember.mockResolvedValue(removedMember);

      const permissionDelete = vi.fn().mockResolvedValue(undefined);
      const channel = {
        id: "channel-1",
        isTextBased: () => true,
        type: ChannelType.GuildText,
        permissionOverwrites: { delete: permissionDelete },
      } as unknown as TextChannel;
      vi.mocked(guild.channels.fetch).mockResolvedValue(channel);

      const removed = await manager.RemoveUserFromTicket(9, "user-2", staffId);
      expect(removed).toBe(true);
      expect(permissionDelete).toHaveBeenCalledWith(removedMember);
      expect(ticketDb.RemoveParticipant).toHaveBeenCalledWith(
        9,
        "user-2",
        staffId,
      );
    });
  });
});

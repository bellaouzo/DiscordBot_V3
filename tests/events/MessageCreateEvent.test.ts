import { describe, expect, it, vi } from "vitest";
import { MessageCreateEvent } from "@events/Client/MessageCreateEvent";
import {
  createMockAppConfig,
  createMockDatabaseSet,
  createMockLogger,
  createMockResponderSet,
} from "../helpers";

describe("MessageCreateEvent", () => {
  it("deletes blocked link messages and DMs a warning notice", async () => {
    const sendDm = vi.fn().mockResolvedValue(undefined);
    const deleteMessage = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {} as never,
      logger: createMockLogger(),
      responders: createMockResponderSet(),
      databases: createMockDatabaseSet(),
      appConfig: createMockAppConfig(),
    };

    (
      context.databases.moderationDb.ListLinkFilters as ReturnType<typeof vi.fn>
    ).mockReturnValue([
      {
        id: 1,
        guild_id: "guild-1",
        pattern: "bad.site",
        type: "block",
        created_by: "mod-1",
        created_at: Date.now(),
      },
    ]);
    (
      context.databases.serverDb.GetGuildSettings as ReturnType<typeof vi.fn>
    ).mockReturnValue(null);

    const message = {
      guild: { id: "guild-1" },
      channel: { isTextBased: () => true },
      author: { id: "user-1", bot: false, send: sendDm },
      member: {
        permissions: { has: () => false },
        roles: { cache: { some: () => false } },
      },
      content: "check this https://bad.site/link",
      delete: deleteMessage,
    } as never;

    await MessageCreateEvent.execute(context as never, message);

    expect(deleteMessage).toHaveBeenCalledTimes(1);
    expect(sendDm).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      }),
    );
    expect(context.databases.ticketDb.AddMessage).not.toHaveBeenCalled();
  });

  it("captures ticket messages when no blocked link match exists", async () => {
    const context = {
      client: {} as never,
      logger: createMockLogger(),
      responders: createMockResponderSet(),
      databases: createMockDatabaseSet(),
      appConfig: createMockAppConfig(),
    };

    (
      context.databases.moderationDb.ListLinkFilters as ReturnType<typeof vi.fn>
    ).mockReturnValue([]);
    (
      context.databases.ticketDb.GetTicketByChannel as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      id: 77,
    });

    const message = {
      guild: { id: "guild-1" },
      channel: { id: "channel-1", isTextBased: () => true },
      author: { id: "user-22", bot: false },
      member: {
        permissions: { has: () => false },
        roles: { cache: { some: () => false } },
      },
      content: "ticket follow-up",
      delete: vi.fn(),
    } as never;

    await MessageCreateEvent.execute(context as never, message);

    expect(context.databases.ticketDb.AddMessage).toHaveBeenCalledWith(
      77,
      "user-22",
      "ticket follow-up",
    );
  });
});

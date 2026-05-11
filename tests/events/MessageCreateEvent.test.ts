import { describe, expect, it, vi } from "vitest";
import { MessageCreateEvent } from "@events/Client/MessageCreateEvent";
import {
  createMockAppConfig,
  createMockDatabaseSet,
  createMockLogger,
  createMockResponderSet,
} from "../helpers";

describe("MessageCreateEvent", () => {
  it("deletes blocked link messages and posts a warning notice", async () => {
    const sendNotice = vi.fn().mockResolvedValue(undefined);
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

    const message = {
      guild: { id: "guild-1" },
      channel: { isTextBased: () => true, send: sendNotice },
      author: { id: "user-1", bot: false },
      content: "check this https://bad.site/link",
      delete: deleteMessage,
    } as never;

    await MessageCreateEvent.execute(context as never, message);

    expect(deleteMessage).toHaveBeenCalledTimes(1);
    expect(sendNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "<@user-1>",
      })
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
    (context.databases.ticketDb.GetTicketByChannel as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        id: 77,
      }
    );

    const message = {
      guild: { id: "guild-1" },
      channel: { id: "channel-1", isTextBased: () => true },
      author: { id: "user-22", bot: false },
      content: "ticket follow-up",
      delete: vi.fn(),
    } as never;

    await MessageCreateEvent.execute(context as never, message);

    expect(context.databases.ticketDb.AddMessage).toHaveBeenCalledWith(
      77,
      "user-22",
      "ticket follow-up"
    );
  });
});

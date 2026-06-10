import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventScheduler } from "@systems/Event/EventScheduler";
import { createMockLogger } from "../../helpers";

describe("EventScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createScheduler(overrides?: {
    dueEvents?: Array<{
      id: number;
      guild_id: string;
      guild_event_id: number;
      title: string;
      scheduled_at: number;
      created_by: string;
    }>;
    settings?: { announcement_channel_id: string | null } | null;
    channel?: {
      isTextBased: () => boolean;
      send: ReturnType<typeof vi.fn>;
    } | null;
  }) {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = overrides?.channel ?? {
      isTextBased: () => true,
      send,
    };
    const serverDb = {
      ListEventsDueForNotification: vi
        .fn()
        .mockReturnValue(overrides?.dueEvents ?? []),
      GetGuildSettings: vi
        .fn()
        .mockReturnValue(
          overrides?.settings === undefined
            ? { announcement_channel_id: "announce-1" }
            : overrides.settings,
        ),
      MarkEventNotified: vi.fn().mockReturnValue(true),
    };
    const client = {
      guilds: {
        fetch: vi.fn().mockResolvedValue({
          channels: {
            fetch: vi.fn().mockResolvedValue(channel),
          },
        }),
      },
    };
    const scheduler = new EventScheduler(
      client as never,
      serverDb as never,
      createMockLogger(),
    );
    return { scheduler, serverDb, client, channel, send };
  }

  it("notifies due events on start", async () => {
    const { scheduler, serverDb, send } = createScheduler({
      dueEvents: [
        {
          id: 1,
          guild_id: "guild-1",
          guild_event_id: 1,
          title: "Raid Night",
          scheduled_at: Date.now() - 1000,
          created_by: "user-1",
        },
      ],
    });

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(send).toHaveBeenCalled();
    expect(serverDb.MarkEventNotified).toHaveBeenCalledWith(
      1,
      expect.any(Number),
    );
  });

  it("marks notified when announcement channel is missing", async () => {
    const logger = createMockLogger();
    const serverDb = {
      ListEventsDueForNotification: vi.fn().mockReturnValue([
        {
          id: 2,
          guild_id: "guild-1",
          guild_event_id: 2,
          title: "Meetup",
          scheduled_at: Date.now() - 1000,
          created_by: "user-2",
        },
      ]),
      GetGuildSettings: vi.fn().mockReturnValue({
        announcement_channel_id: null,
      }),
      MarkEventNotified: vi.fn().mockReturnValue(true),
    };
    const scheduler = new EventScheduler(
      { guilds: { fetch: vi.fn() } } as never,
      serverDb as never,
      logger,
    );

    scheduler.Start();
    await vi.runOnlyPendingTimersAsync();
    scheduler.Stop();

    expect(serverDb.MarkEventNotified).toHaveBeenCalledWith(
      2,
      expect.any(Number),
    );
    expect(logger.Warn).toHaveBeenCalledWith(
      "No announcement channel configured for event notification",
      expect.any(Object),
    );
  });

  it("warns when scheduler is started twice", () => {
    const logger = createMockLogger();
    const scheduler = new EventScheduler(
      { guilds: { fetch: vi.fn() } } as never,
      {
        ListEventsDueForNotification: vi.fn().mockReturnValue([]),
        GetGuildSettings: vi.fn(),
        MarkEventNotified: vi.fn(),
      } as never,
      logger,
    );

    scheduler.Start();
    scheduler.Start();

    expect(logger.Warn).toHaveBeenCalledWith("EventScheduler already running");
    scheduler.Stop();
  });
});

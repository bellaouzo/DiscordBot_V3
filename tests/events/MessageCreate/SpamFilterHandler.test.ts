import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "discord.js";
import { SpamFilterHandler } from "@events/MessageCreate/SpamFilterHandler";
import type { EventContext } from "@events/EventFactory";
import { SharedSpamDetector } from "@systems/Moderation/SpamDetector";
import { SPAM_FILTER_DEFAULTS } from "@database/Moderation/Types";
import { createMockDatabaseSet, createMockLogger } from "../../helpers";

let messageCounter = 0;

function CreateMessage(options: { mentions?: number; userId?: string } = {}) {
  messageCounter += 1;
  const timeout = vi.fn().mockResolvedValue(undefined);
  const channel = {
    isTextBased: () => true,
    isThread: () => false,
    isDMBased: () => false,
    send: vi
      .fn()
      .mockResolvedValue({ delete: vi.fn().mockResolvedValue(undefined) }),
    messages: { delete: vi.fn().mockResolvedValue(undefined) },
    bulkDelete: vi.fn().mockResolvedValue(undefined),
  };
  const member = {
    id: options.userId ?? "u1",
    moderatable: true,
    timeout,
    guild: { id: "g1" },
    roles: { cache: { some: () => false } },
    permissions: { has: () => false },
  };
  const guild = {
    id: "g1",
    name: "Cafe",
    channels: {
      cache: { get: () => channel },
      fetch: vi.fn().mockResolvedValue(null),
    },
    members: { fetch: vi.fn().mockResolvedValue(member) },
  };
  const mentionedUsers = new Map(
    Array.from({ length: options.mentions ?? 0 }, (_, i) => [String(i), {}]),
  );
  const message = {
    id: `msg-${messageCounter}`,
    content: `message ${messageCounter}`,
    createdTimestamp: Date.now(),
    channelId: "c1",
    channel,
    guild,
    member,
    client: { user: { id: "bot" } },
    author: {
      id: options.userId ?? "u1",
      send: vi.fn().mockResolvedValue(undefined),
    },
    mentions: {
      users: mentionedUsers,
      roles: new Map(),
      everyone: false,
    },
  } as unknown as Message;
  return { message, member, channel };
}

function CreateContext(enabled: boolean) {
  const databases = createMockDatabaseSet();
  vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue({
    spam_filter_enabled: enabled,
    admin_role_ids: [],
    mod_role_ids: [],
  } as never);
  vi.mocked(databases.moderationDb.GetSpamFilterSettings).mockReturnValue({
    guild_id: "g1",
    ...SPAM_FILTER_DEFAULTS,
  });
  vi.mocked(databases.moderationDb.CountSpamStrikesSince).mockReturnValue(0);
  return {
    context: {
      databases,
      logger: createMockLogger(),
    } as unknown as EventContext,
    databases,
  };
}

describe("SpamFilterHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SharedSpamDetector.Reset("g1", "u1");
  });

  it("does nothing when the filter is disabled", async () => {
    const { context, databases } = CreateContext(false);
    const { message } = CreateMessage({ mentions: 20 });

    expect(await SpamFilterHandler.execute(context, message)).toBe("continue");
    expect(databases.moderationDb.AddSpamStrike).not.toHaveBeenCalled();
  });

  it("lets normal messages through", async () => {
    const { context } = CreateContext(true);
    const { message } = CreateMessage();

    expect(await SpamFilterHandler.execute(context, message)).toBe("continue");
  });

  it("removes mass mentions and records a warning strike", async () => {
    const { context, databases } = CreateContext(true);
    const { message, member, channel } = CreateMessage({ mentions: 8 });

    expect(await SpamFilterHandler.execute(context, message)).toBe("stop");
    expect(channel.messages.delete).toHaveBeenCalledWith(message.id);
    expect(databases.moderationDb.AddSpamStrike).toHaveBeenCalledWith(
      expect.objectContaining({
        guild_id: "g1",
        user_id: "u1",
        action: "warn",
      }),
    );
    expect(member.timeout).not.toHaveBeenCalled();
  });

  it("times out repeat offenders based on active strikes", async () => {
    const { context, databases } = CreateContext(true);
    vi.mocked(databases.moderationDb.CountSpamStrikesSince).mockReturnValue(1);
    const { message, member } = CreateMessage({ mentions: 8 });

    await SpamFilterHandler.execute(context, message);

    expect(member.timeout).toHaveBeenCalledWith(
      10 * 60 * 1000,
      expect.stringContaining("[Spam filter]"),
    );
    expect(databases.moderationDb.AddTempAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mute", user_id: "u1" }),
    );
    expect(databases.moderationDb.AddSpamStrike).toHaveBeenCalledWith(
      expect.objectContaining({ action: "timeout", duration_ms: 600_000 }),
    );
  });

  it("falls back to a warning when the member cannot be timed out", async () => {
    const { context, databases } = CreateContext(true);
    vi.mocked(databases.moderationDb.CountSpamStrikesSince).mockReturnValue(2);
    const { message, member } = CreateMessage({ mentions: 8 });
    member.moderatable = false;

    await SpamFilterHandler.execute(context, message);

    expect(member.timeout).not.toHaveBeenCalled();
    expect(databases.moderationDb.AddSpamStrike).toHaveBeenCalledWith(
      expect.objectContaining({ action: "warn", duration_ms: null }),
    );
  });

  it("skips exempt channels", async () => {
    const { context, databases } = CreateContext(true);
    vi.mocked(databases.moderationDb.GetSpamFilterSettings).mockReturnValue({
      guild_id: "g1",
      ...SPAM_FILTER_DEFAULTS,
      exempt_channel_ids: ["c1"],
    });
    const { message } = CreateMessage({ mentions: 20 });

    expect(await SpamFilterHandler.execute(context, message)).toBe("continue");
  });
});

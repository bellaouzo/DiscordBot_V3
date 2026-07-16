import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ChannelType } from "discord.js";
import { ProtectedChannelGuardHandler } from "@events/MessageCreate/ProtectedChannelGuardHandler";
import {
  BuildProtectedChannelNoticeDescription,
  ResolveProtectedChannelMatch,
} from "@events/MessageCreate/ProtectedChannelGuard";
import { createMockLogger, createMockDatabaseSet } from "../../helpers";
import { IsModerator } from "@utilities";
import { ResolveMessageMember } from "@utilities";

vi.mock("@utilities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@utilities")>();
  return {
    ...actual,
    IsModerator: vi.fn(),
    ResolveMessageMember: vi.fn(),
  };
});

function createContext(settings: unknown) {
  const databases = createMockDatabaseSet();
  vi.mocked(databases.serverDb.GetGuildSettings).mockReturnValue(
    settings as never,
  );

  return {
    logger: createMockLogger(),
    databases,
  };
}

function createTextChannel(id: string, name: string) {
  return {
    id,
    name,
    type: ChannelType.GuildText,
    isDMBased: () => false,
    isTextBased: () => true,
    send: vi.fn().mockResolvedValue({
      id: "notice-1",
      delete: vi.fn().mockResolvedValue(undefined),
    }),
    toString: () => `<#${id}>`,
  };
}

describe("ResolveProtectedChannelMatch", () => {
  it("matches verification, log, rules, and panel channels", () => {
    const guild = { id: "guild-1", rulesChannelId: "rules-official" } as never;
    const settings = {
      verification_enabled: true,
      verification_channel_id: "verify-1",
      command_log_channel_id: "cmd-log",
      ticket_log_channel_id: null,
      delete_log_channel_id: null,
      production_log_channel_id: null,
      starboard_channel_id: null,
    } as never;

    expect(
      ResolveProtectedChannelMatch({
        guild,
        channelId: "verify-1",
        channel: createTextChannel("verify-1", "verification") as never,
        settings,
      })?.reason,
    ).toContain("verification");

    expect(
      ResolveProtectedChannelMatch({
        guild,
        channelId: "cmd-log",
        channel: createTextChannel("cmd-log", "command-logs") as never,
        settings,
      })?.reason,
    ).toContain("command-log");

    expect(
      ResolveProtectedChannelMatch({
        guild,
        channelId: "rules-official",
        channel: createTextChannel("rules-official", "rules") as never,
        settings,
      })?.reason,
    ).toContain("rules");

    expect(
      ResolveProtectedChannelMatch({
        guild,
        channelId: "tickets-1",
        channel: createTextChannel("tickets-1", "tickets") as never,
        settings,
      })?.reason,
    ).toContain("support tickets");

    expect(
      ResolveProtectedChannelMatch({
        guild,
        channelId: "appeals-1",
        channel: createTextChannel("appeals-1", "appeals") as never,
        settings,
      })?.reason,
    ).toContain("appeals");
  });

  it("ignores normal chat channels", () => {
    expect(
      ResolveProtectedChannelMatch({
        guild: { id: "guild-1", rulesChannelId: null } as never,
        channelId: "general-1",
        channel: createTextChannel("general-1", "general") as never,
        settings: {
          verification_enabled: true,
          verification_channel_id: "verify-1",
        } as never,
      }),
    ).toBeNull();
  });
});

describe("ProtectedChannelGuardHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(IsModerator).mockReturnValue(false);
    vi.mocked(ResolveMessageMember).mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("continues for moderators", async () => {
    vi.mocked(IsModerator).mockReturnValue(true);
    const context = createContext({
      verification_enabled: true,
      verification_channel_id: "verify-1",
      admin_role_ids: [],
      mod_role_ids: [],
    });
    const channel = createTextChannel("verify-1", "verification");
    const msg = {
      guild: { id: "guild-1", rulesChannelId: null },
      channelId: "verify-1",
      channel,
      author: { id: "user-1" },
      delete: vi.fn(),
    };

    await expect(
      ProtectedChannelGuardHandler.execute(context as never, msg as never),
    ).resolves.toBe("continue");
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it("deletes member messages and sends an in-channel notice", async () => {
    const context = createContext({
      verification_enabled: true,
      verification_channel_id: "verify-1",
      admin_role_ids: [],
      mod_role_ids: [],
      command_log_channel_id: null,
      ticket_log_channel_id: null,
      delete_log_channel_id: null,
      production_log_channel_id: null,
      starboard_channel_id: null,
    });
    const channel = createTextChannel("verify-1", "verification");
    const msg = {
      guild: { id: "guild-1", rulesChannelId: null },
      channelId: "verify-1",
      channel,
      author: { id: "user-1", toString: () => "<@user-1>" },
      id: "msg-1",
      delete: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      ProtectedChannelGuardHandler.execute(context as never, msg as never),
    ).resolves.toBe("stop");
    expect(msg.delete).toHaveBeenCalledOnce();
    expect(channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "<@user-1>",
        allowedMentions: { users: ["user-1"] },
      }),
    );

    await vi.advanceTimersByTimeAsync(12_000);
    const sent = await channel.send.mock.results[0].value;
    expect(sent.delete).toHaveBeenCalledOnce();
  });

  it("builds a clear notice description", () => {
    const description = BuildProtectedChannelNoticeDescription(
      {
        channel: {
          isDMBased: () => false,
          toString: () => "<#verify-1>",
        },
      } as never,
      "This is the verification channel.",
    );

    expect(description).toContain("<#verify-1>");
    expect(description).toContain("This is the verification channel.");
  });
});

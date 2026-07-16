import { describe, expect, it, vi } from "vitest";
import type { TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import {
  FormatSetupPanelResults,
  PostMissingSetupPanels,
} from "@systems/Setup/panels/PostSetupPanels";
import {
  ChannelHasEmbedFooterMarker,
  ChannelHasPanelButton,
} from "@systems/Setup/panels/PanelPresence";
import { FetchGuildServerRules } from "@systems/Setup/panels/FetchGuildServerRules";
import { createMockLogger } from "../../helpers";
import type { GuildSettings } from "@database/Server/Types";

vi.mock("@systems/Setup/panels/PanelPresence", () => ({
  ChannelHasPanelButton: vi.fn(),
  ChannelHasEmbedFooterMarker: vi.fn(),
}));

vi.mock("@systems/Setup/panels/FetchGuildServerRules", () => ({
  FetchGuildServerRules: vi.fn(),
}));

vi.mock("@systems/Setup/panels/RulesPanel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@systems/Setup/panels/RulesPanel")>();
  return {
    ...actual,
    PostRulesPanelToChannel: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@systems/Verification/VerificationPanelFlow", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@systems/Verification/VerificationPanelFlow")
    >();
  return {
    ...actual,
    PostVerificationPanelToChannel: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@systems/Ticket/TicketPanelFlow", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@systems/Ticket/TicketPanelFlow")>();
  return {
    ...actual,
    PostTicketPanelToChannel: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@commands/Moderation/Appeal/AppealPanelFlow", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@commands/Moderation/Appeal/AppealPanelFlow")
    >();
  return {
    ...actual,
    PostAppealPanelToChannel: vi.fn().mockResolvedValue(undefined),
  };
});

function createSettings(
  overrides: Partial<GuildSettings> = {},
): GuildSettings {
  return {
    guild_id: "guild-1",
    admin_role_ids: ["admin"],
    mod_role_ids: [],
    ticket_category_id: null,
    appeal_review_category_id: null,
    command_log_channel_id: null,
    ticket_log_channel_id: null,
    announcement_channel_id: null,
    delete_log_channel_id: null,
    production_log_channel_id: null,
    welcome_channel_id: null,
    autorole_id: null,
    starboard_channel_id: null,
    starboard_emoji: "⭐",
    starboard_threshold: 3,
    roblox_linked_discord_user_id: null,
    roblox_linked_at: null,
    verification_enabled: false,
    unverified_role_id: null,
    verified_role_id: null,
    verification_min_account_age_days: 0,
    verification_channel_id: null,
    economy_enabled: true,
    giveaways_enabled: true,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function createTextChannel(id: string): TextChannel {
  return {
    id,
    guildId: "guild-1",
    type: ChannelType.GuildText,
    isTextBased: () => true,
  } as never;
}

function createGuild() {
  return {
    id: "guild-1",
    rulesChannelId: null,
    features: [],
    channels: { fetch: vi.fn() },
    setRulesChannel: vi.fn(),
  };
}

describe("PostMissingSetupPanels", () => {
  it("posts missing ticket and appeal panels and skips verification when disabled", async () => {
    const rulesChannel = createTextChannel("rules-1");
    const ticketChannel = createTextChannel("tickets-1");
    const appealChannel = createTextChannel("appeals-1");
    const channelManager = {
      GetOrCreateCategory: vi.fn(),
      GetOrCreateTextChannel: vi
        .fn()
        .mockResolvedValueOnce(rulesChannel)
        .mockResolvedValueOnce(ticketChannel)
        .mockResolvedValueOnce(appealChannel),
    };
    vi.mocked(FetchGuildServerRules).mockResolvedValue({
      description: null,
      rules: ["Be nice"],
    });
    vi.mocked(ChannelHasEmbedFooterMarker).mockResolvedValue(false);
    vi.mocked(ChannelHasPanelButton).mockResolvedValue(false);

    const results = await PostMissingSetupPanels({
      guild: createGuild() as never,
      settings: createSettings(),
      channelManager: channelManager as never,
      logger: createMockLogger(),
    });

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rules",
          status: "posted",
          channelId: "rules-1",
        }),
        expect.objectContaining({
          id: "ticket",
          status: "posted",
          channelId: "tickets-1",
        }),
        expect.objectContaining({
          id: "appeal",
          status: "posted",
          channelId: "appeals-1",
        }),
      ]),
    );
    expect(results.some((result) => result.id === "verification")).toBe(false);
  });

  it("skips panels that are already posted", async () => {
    const rulesChannel = createTextChannel("rules-1");
    const ticketChannel = createTextChannel("tickets-1");
    const appealChannel = createTextChannel("appeals-1");
    const verifyChannel = createTextChannel("verify-1");
    const channelManager = {
      GetOrCreateCategory: vi.fn(),
      GetOrCreateTextChannel: vi
        .fn()
        .mockResolvedValueOnce(rulesChannel)
        .mockResolvedValueOnce(ticketChannel)
        .mockResolvedValueOnce(appealChannel),
    };
    vi.mocked(FetchGuildServerRules).mockResolvedValue({
      description: null,
      rules: ["Be nice"],
    });
    vi.mocked(ChannelHasEmbedFooterMarker).mockResolvedValue(true);
    vi.mocked(ChannelHasPanelButton).mockResolvedValue(true);

    const results = await PostMissingSetupPanels({
      guild: {
        ...createGuild(),
        channels: {
          fetch: vi.fn().mockResolvedValue(verifyChannel),
        },
      } as never,
      settings: createSettings({
        verification_enabled: true,
        unverified_role_id: "role-1",
        verification_channel_id: "verify-1",
      }),
      channelManager: channelManager as never,
      logger: createMockLogger(),
    });

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "rules", status: "already_posted" }),
        expect.objectContaining({
          id: "verification",
          status: "already_posted",
        }),
        expect.objectContaining({ id: "ticket", status: "already_posted" }),
        expect.objectContaining({ id: "appeal", status: "already_posted" }),
      ]),
    );
  });

  it("skips rules when Discord Server Rules are not configured", async () => {
    const channelManager = {
      GetOrCreateCategory: vi.fn(),
      GetOrCreateTextChannel: vi
        .fn()
        .mockResolvedValueOnce(createTextChannel("tickets-1"))
        .mockResolvedValueOnce(createTextChannel("appeals-1")),
    };
    vi.mocked(FetchGuildServerRules).mockResolvedValue(null);
    vi.mocked(ChannelHasPanelButton).mockResolvedValue(false);

    const results = await PostMissingSetupPanels({
      guild: createGuild() as never,
      settings: createSettings(),
      channelManager: channelManager as never,
      logger: createMockLogger(),
    });

    expect(results.find((result) => result.id === "rules")).toEqual(
      expect.objectContaining({
        status: "skipped",
        detail: expect.stringContaining("No Discord Server Rules found"),
      }),
    );
  });

  it("skips verification when channel is missing", async () => {
    const channelManager = {
      GetOrCreateCategory: vi.fn(),
      GetOrCreateTextChannel: vi
        .fn()
        .mockResolvedValueOnce(createTextChannel("tickets-1"))
        .mockResolvedValueOnce(createTextChannel("appeals-1")),
    };
    vi.mocked(FetchGuildServerRules).mockResolvedValue(null);
    vi.mocked(ChannelHasPanelButton).mockResolvedValue(false);

    const results = await PostMissingSetupPanels({
      guild: createGuild() as never,
      settings: createSettings({
        verification_enabled: true,
        unverified_role_id: "role-1",
        verification_channel_id: null,
      }),
      channelManager: channelManager as never,
      logger: createMockLogger(),
    });

    expect(results.find((result) => result.id === "verification")).toEqual(
      expect.objectContaining({
        status: "skipped",
        detail: "Verification channel is not configured.",
      }),
    );
  });
});

describe("FormatSetupPanelResults", () => {
  it("formats posted and skipped results", () => {
    const lines = FormatSetupPanelResults([
      {
        id: "ticket",
        label: "Ticket panel",
        status: "posted",
        channelId: "tickets-1",
      },
      {
        id: "verification",
        label: "Verification panel",
        status: "skipped",
        detail: "Verification channel is not configured.",
      },
    ]);

    expect(lines[0]).toContain("Posted Ticket panel");
    expect(lines[0]).toContain("<#tickets-1>");
    expect(lines[1]).toContain("Skipped Verification panel");
  });
});

import { describe, expect, it, vi } from "vitest";
import { MembershipScreeningFieldType } from "discord-api-types/v10";
import { FetchGuildServerRules } from "@systems/Setup/panels/FetchGuildServerRules";
import {
  BuildRulesPanelEmbeds,
  RULES_PANEL_FOOTER_MARKER,
} from "@systems/Setup/panels/RulesPanel";
import { ChannelHasEmbedFooterMarker } from "@systems/Setup/panels/PanelPresence";
import { createMockLogger } from "../../helpers";

describe("FetchGuildServerRules", () => {
  it("extracts TERMS values from membership screening", async () => {
    const restGet = vi.fn().mockResolvedValue({
      version: "1",
      description: "Be excellent to each other",
      form_fields: [
        {
          field_type: MembershipScreeningFieldType.Terms,
          label: "Rules",
          values: ["Be respectful", "No spam", "  "],
          required: true,
        },
      ],
    });

    const result = await FetchGuildServerRules({
      guild: {
        id: "guild-1",
        client: { rest: { get: restGet } },
      } as never,
      logger: createMockLogger(),
    });

    expect(result).toEqual({
      description: "Be excellent to each other",
      rules: ["Be respectful", "No spam"],
    });
  });

  it("returns null when no rules are configured", async () => {
    const restGet = vi.fn().mockResolvedValue({
      version: "1",
      description: null,
      form_fields: [],
    });

    const result = await FetchGuildServerRules({
      guild: {
        id: "guild-1",
        client: { rest: { get: restGet } },
      } as never,
      logger: createMockLogger(),
    });

    expect(result).toBeNull();
  });

  it("returns null when the API request fails", async () => {
    const logger = createMockLogger();
    const restGet = vi.fn().mockRejectedValue(new Error("forbidden"));

    const result = await FetchGuildServerRules({
      guild: {
        id: "guild-1",
        client: { rest: { get: restGet } },
      } as never,
      logger,
    });

    expect(result).toBeNull();
    expect(logger.Warn).toHaveBeenCalled();
  });
});

describe("BuildRulesPanelEmbeds", () => {
  it("builds a polished single embed with rules and footer marker", () => {
    const embeds = BuildRulesPanelEmbeds(
      {
        name: "Test Guild",
        iconURL: () => "https://example.com/icon.png",
      } as never,
      {
        description: "A friendly community",
        rules: ["Be kind", "No spam"],
      },
    );

    expect(embeds).toHaveLength(1);
    expect(embeds[0].title).toContain("Test Guild");
    expect(embeds[0].description).toContain("A friendly community");
    expect(embeds[0].description).toContain("**1.** Be kind");
    expect(embeds[0].description).toContain("**2.** No spam");
    expect(embeds[0].footer?.text).toContain(RULES_PANEL_FOOTER_MARKER);
    expect(
      embeds[0].fields?.some((field) => field.name === "How we moderate"),
    ).toBe(true);
  });
});

describe("ChannelHasEmbedFooterMarker", () => {
  it("detects an existing rules panel by footer marker", async () => {
    const channel = {
      messages: {
        fetch: vi.fn().mockResolvedValue(
          new Map([
            [
              "msg-1",
              {
                embeds: [
                  {
                    footer: {
                      text: `${RULES_PANEL_FOOTER_MARKER} · 3 rule(s)`,
                    },
                  },
                ],
              },
            ],
          ]),
        ),
      },
    } as never;

    await expect(
      ChannelHasEmbedFooterMarker(channel, RULES_PANEL_FOOTER_MARKER),
    ).resolves.toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { ButtonStyle } from "discord.js";
import { BuildHubPayload } from "@commands/Utility/Hub/HubComponents";
import type { HubContext } from "@commands/Utility/Hub/HubComponents";
function CreateHubContext(
  overrides: Partial<HubContext> = {},
): HubContext {
  return {
    guildId: "guild-1",
    guildName: "Test Guild",
    interactionId: "1234567890",
    member: {
      id: "user-1",
      roles: { cache: { has: () => false } },
    } as HubContext["member"],
    settings: {
      ticket_category_id: "cat-1",
      appeal_review_category_id: "appeal-cat",
      verification_enabled: true,
      unverified_role_id: "unverified-role",
    } as HubContext["settings"],
    isStaff: false,
    ...overrides,
  };
}

describe("HubComponents", () => {
  it("includes ticket and appeal buttons when configured", () => {
    const payload = BuildHubPayload(CreateHubContext());

    const customIds = payload.components
      .flatMap((row) => row.components)
      .map((component) =>
        "custom_id" in component
          ? component.custom_id
          : "customId" in component
            ? component.customId
            : "",
      );

    expect(customIds.some((id) => id?.includes(":ticket"))).toBe(true);
    expect(customIds.some((id) => id?.includes(":appeal"))).toBe(true);
    expect(customIds.some((id) => id?.includes(":help"))).toBe(true);
  });

  it("hides ticket button when ticket category is not configured", () => {
    const payload = BuildHubPayload(
      CreateHubContext({
        settings: {
          ticket_category_id: null,
          appeal_review_category_id: null,
          verification_enabled: false,
          unverified_role_id: null,
        } as HubContext["settings"],
      }),
    );

    const customIds = payload.components
      .flatMap((row) => row.components)
      .map((component) =>
        "custom_id" in component
          ? component.custom_id
          : "customId" in component
            ? component.customId
            : "",
      );

    expect(customIds.some((id) => id?.includes(":ticket"))).toBe(false);
    expect(customIds.some((id) => id?.includes(":appeal"))).toBe(false);
  });

  it("includes verify button when member is unverified", () => {
    const payload = BuildHubPayload(
      CreateHubContext({
        member: {
          id: "user-1",
          roles: { cache: { has: (id: string) => id === "unverified-role" } },
        } as HubContext["member"],
      }),
    );

    const verifyButton = payload.components
      .flatMap((row) => row.components)
      .find((component) => {
        const customId =
          "custom_id" in component
            ? component.custom_id
            : "customId" in component
              ? component.customId
              : "";
        return customId?.includes(":verify");
      });

    expect(verifyButton).toBeDefined();
    if (verifyButton && "style" in verifyButton) {
      expect(verifyButton.style).toBe(ButtonStyle.Success);
    }
  });

  it("includes staff buttons for moderators", () => {
    const payload = BuildHubPayload(
      CreateHubContext({ isStaff: true }),
    );

    const customIds = payload.components
      .flatMap((row) => row.components)
      .map((component) =>
        "custom_id" in component
          ? component.custom_id
          : "customId" in component
            ? component.customId
            : "",
      );

    expect(customIds.some((id) => id?.includes(":staff-tickets"))).toBe(true);
    expect(customIds.some((id) => id?.includes(":staff-appeals"))).toBe(true);
    expect(customIds.some((id) => id?.includes(":staff-commands"))).toBe(true);
  });
});

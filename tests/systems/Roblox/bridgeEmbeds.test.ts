import { describe, expect, it } from "vitest";
import {
  BuildStatusEmbed,
  ExtractErrorMessage,
} from "@systems/Roblox/bridgeEmbeds";

describe("bridgeEmbeds", () => {
  describe("ExtractErrorMessage", () => {
    it("returns string errors directly", () => {
      expect(ExtractErrorMessage("bad request")).toBe("bad request");
    });

    it("returns message property from error objects", () => {
      expect(ExtractErrorMessage({ message: "upstream failed" })).toBe(
        "upstream failed",
      );
    });

    it("returns undefined for empty input", () => {
      expect(ExtractErrorMessage(null)).toBeUndefined();
    });
  });

  describe("BuildStatusEmbed", () => {
    it("builds not-connected error embed", () => {
      const embed = BuildStatusEmbed({ configured: false });
      expect(embed.data.title).toBe("Roblox Not Connected");
    });

    it("uses universe labels for experience keys", () => {
      const embed = BuildStatusEmbed({
        configured: true,
        keyType: "experience",
        targetId: "555",
      });

      const fieldNames = embed.data.fields?.map((field) => field.name) ?? [];
      expect(fieldNames).toContain("Universe ID");
    });

    it("builds connected embed with metadata fields", () => {
      const embed = BuildStatusEmbed({
        configured: true,
        linkedDiscordUserId: "user-1",
        keyType: "group",
        targetId: "999",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      });

      expect(embed.data.title).toBe("Roblox Connected");
      const fieldNames = embed.data.fields?.map((field) => field.name) ?? [];
      expect(fieldNames).toContain("Configured By");
      expect(fieldNames).toContain("Key Type");
      expect(fieldNames).toContain("Group ID");
      expect(fieldNames).toContain("Created At");
      expect(fieldNames).toContain("Updated At");
    });
  });
});

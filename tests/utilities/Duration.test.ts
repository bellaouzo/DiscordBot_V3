import { describe, it, expect } from "vitest";
import {
  ConvertDurationToMs,
  FormatDuration,
  ParseDuration,
} from "@utilities/Duration";

describe("Duration", () => {
  describe("ConvertDurationToMs", () => {
    it("converts seconds", () => {
      expect(ConvertDurationToMs(1, "seconds")).toBe(1000);
      expect(ConvertDurationToMs(30, "seconds")).toBe(30_000);
    });

    it("converts minutes", () => {
      expect(ConvertDurationToMs(1, "minutes")).toBe(60_000);
      expect(ConvertDurationToMs(5, "minutes")).toBe(300_000);
    });

    it("converts hours", () => {
      expect(ConvertDurationToMs(1, "hours")).toBe(3_600_000);
    });

    it("converts days", () => {
      expect(ConvertDurationToMs(1, "days")).toBe(86_400_000);
    });
  });

  describe("FormatDuration", () => {
    it("formats singular unit", () => {
      expect(FormatDuration(1, "seconds")).toBe("1 second");
      expect(FormatDuration(1, "minutes")).toBe("1 minute");
    });

    it("formats plural unit", () => {
      expect(FormatDuration(2, "seconds")).toBe("2 seconds");
      expect(FormatDuration(3, "hours")).toBe("3 hours");
    });
  });

  describe("ParseDuration", () => {
    it("returns null for empty or invalid input", () => {
      expect(ParseDuration("")).toBeNull();
      expect(ParseDuration("   ")).toBeNull();
      expect(ParseDuration("abc")).toBeNull();
      expect(ParseDuration("1x")).toBeNull();
    });

    it("parses simple formats (s, m, h, d, w)", () => {
      expect(ParseDuration("30s")).toBe(30_000);
      expect(ParseDuration("5m")).toBe(5 * 60_000);
      expect(ParseDuration("2h")).toBe(2 * 3_600_000);
      expect(ParseDuration("1d")).toBe(86_400_000);
      expect(ParseDuration("1w")).toBe(7 * 86_400_000);
    });

    it("parses compound formats", () => {
      expect(ParseDuration("1d12h")).toBe(86_400_000 + 12 * 3_600_000);
      expect(ParseDuration("2h30m")).toBe(2 * 3_600_000 + 30 * 60_000);
    });

    it("is case insensitive", () => {
      expect(ParseDuration("30S")).toBe(30_000);
      expect(ParseDuration("5M")).toBe(5 * 60_000);
    });
  });
});

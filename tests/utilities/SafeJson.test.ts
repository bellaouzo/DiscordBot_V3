import { describe, it, expect } from "vitest";
import {
  SafeParseJson,
  isStringArray,
  isRecord,
  isNumber,
  isString,
} from "@utilities/SafeJson";

describe("SafeJson", () => {
  describe("SafeParseJson", () => {
    it("returns success and data for valid JSON", () => {
      const result = SafeParseJson<{ a: number }>('{"a":1}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ a: 1 });
    });

    it("returns success for valid JSON array", () => {
      const result = SafeParseJson<number[]>("[1,2,3]");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it("returns failure for invalid JSON", () => {
      const result = SafeParseJson("{ invalid }");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns failure when validator rejects", () => {
      const result = SafeParseJson<{ id: number }>(
        '{"id":"not-a-number"}',
        (d): d is { id: number } =>
          typeof d === "object" &&
          d !== null &&
          typeof (d as { id: unknown }).id === "number"
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Validation failed");
    });

    it("returns success when validator accepts", () => {
      const result = SafeParseJson<{ id: number }>(
        '{"id":42}',
        (d): d is { id: number } =>
          typeof d === "object" &&
          d !== null &&
          typeof (d as { id: unknown }).id === "number"
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 42 });
    });
  });

  describe("isStringArray", () => {
    it("returns true for string array", () => {
      expect(isStringArray(["a", "b"])).toBe(true);
    });

    it("returns false for non-array", () => {
      expect(isStringArray({})).toBe(false);
      expect(isStringArray(null)).toBe(false);
    });

    it("returns false for array with non-strings", () => {
      expect(isStringArray([1, 2])).toBe(false);
      expect(isStringArray(["a", 1])).toBe(false);
    });
  });

  describe("isRecord", () => {
    it("returns true for plain object", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });

    it("returns false for null, array, primitive", () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord([])).toBe(false);
      expect(isRecord("x")).toBe(false);
      expect(isRecord(1)).toBe(false);
    });
  });

  describe("isNumber", () => {
    it("returns true for number", () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(1.5)).toBe(true);
    });

    it("returns false for NaN and non-numbers", () => {
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber("1")).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe("isString", () => {
    it("returns true for string", () => {
      expect(isString("")).toBe(true);
      expect(isString("hello")).toBe(true);
    });

    it("returns false for non-strings", () => {
      expect(isString(1)).toBe(false);
      expect(isString(null)).toBe(false);
    });
  });
});

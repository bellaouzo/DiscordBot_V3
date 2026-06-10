import { describe, expect, it } from "vitest";
import {
  GroupAuditErrorMessage,
  GroupAuditErrorTitle,
} from "@systems/Roblox/errors";

const codes = [
  "NOT_CONNECTED",
  "NO_GROUP_KEY",
  "KEY_TYPE_EXPERIENCE",
  "INSUFFICIENT_SCOPE",
  "MEMBER_NOT_FOUND",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "INVALID_API_KEY",
  "SIGNATURE_INVALID",
  "SIGNATURE_USED",
] as const;

describe("Roblox errors", () => {
  it.each(codes)("maps %s to a specific title", (code) => {
    const title = GroupAuditErrorTitle(code);
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe("Group Audit Failed");
  });

  it.each(codes)("maps %s to a specific message", (code) => {
    const message = GroupAuditErrorMessage(code, "fallback");
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe("fallback");
  });

  it("uses fallback title and message for unknown codes", () => {
    expect(GroupAuditErrorTitle("UNKNOWN")).toBe("Group Audit Failed");
    expect(GroupAuditErrorMessage("UNKNOWN", "custom fallback")).toBe(
      "custom fallback",
    );
  });
});

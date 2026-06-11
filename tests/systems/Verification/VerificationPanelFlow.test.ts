import { describe, expect, it } from "vitest";
import {
  VERIFICATION_PANEL_BEGIN_CUSTOM_ID,
  VERIFICATION_PANEL_CHECK_CUSTOM_ID,
  VERIFICATION_PANEL_CONFIRM_CUSTOM_ID,
} from "@systems/Verification/VerificationPanelFlow";

describe("VerificationPanelFlow", () => {
  it("uses stable panel button custom ids", () => {
    expect(VERIFICATION_PANEL_BEGIN_CUSTOM_ID).toBe("verification-panel:begin");
    expect(VERIFICATION_PANEL_CHECK_CUSTOM_ID).toBe("verification-panel:check");
    expect(VERIFICATION_PANEL_CONFIRM_CUSTOM_ID).toBe(
      "verification-panel:confirm",
    );
  });
});

import { describe, it, expect } from "vitest";
import {
  DEFAULT_TICKET_CATEGORY,
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  DEFAULT_DELETE_LOG_CHANNEL,
  DEFAULT_PRODUCTION_LOG_CHANNEL,
  SETUP_TIMEOUT_MS,
} from "@systems/Setup/constants";

describe("Setup constants", () => {
  it("exports default channel/category names", () => {
    expect(DEFAULT_TICKET_CATEGORY).toBe("Support Tickets");
    expect(DEFAULT_ANNOUNCEMENT_CHANNEL).toBe("announcements");
    expect(DEFAULT_DELETE_LOG_CHANNEL).toBe("delete-logs");
    expect(DEFAULT_PRODUCTION_LOG_CHANNEL).toBe("production-logs");
  });

  it("exports setup timeout as 10 minutes in ms", () => {
    expect(SETUP_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });
});

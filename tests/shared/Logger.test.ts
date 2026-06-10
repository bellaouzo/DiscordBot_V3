import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateConsoleLogger } from "@shared/Logger";

describe("CreateConsoleLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes Error objects with message and stack in context", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = CreateConsoleLogger();
    const error = new Error("Invalid token");

    logger.Error("Failed to start bot", {
      error,
      phase: "bootstrap",
    });

    expect(errorSpy).toHaveBeenCalledTimes(3);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("Failed to start bot");
    expect(errorSpy.mock.calls[0]?.[0]).toContain("message: Invalid token");
    expect(errorSpy.mock.calls[0]?.[0]).toContain("phase: bootstrap");
    expect(errorSpy.mock.calls[1]?.[0]).toContain("Caused by: Invalid token");
    expect(errorSpy.mock.calls[2]?.[0]).toContain("Logger.test.ts");
  });

  it("prints caused-by details for non-Error values", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = CreateConsoleLogger();

    logger.Error("Operation failed", {
      error: "missing configuration",
      phase: "bootstrap",
    });

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls[1]?.[0]).toContain(
      "Caused by: missing configuration",
    );
  });
});

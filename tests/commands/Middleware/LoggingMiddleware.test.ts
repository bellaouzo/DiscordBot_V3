import { describe, it, expect, vi } from "vitest";
import { LoggingMiddleware } from "@middleware/LoggingMiddleware";
import { RunMiddlewareChain } from "@middleware";
import type { CommandMiddleware } from "@middleware";
import { createMockMiddlewareContext } from "../../helpers";

const Blocker: CommandMiddleware = {
  name: "blocker",
  execute: async () => undefined,
};

describe("LoggingMiddleware", () => {
  it("logs completion with a duration when the handler runs", async () => {
    const context = createMockMiddlewareContext();

    await RunMiddlewareChain([LoggingMiddleware], context, async () => {});

    expect(context.logger.Info).toHaveBeenCalledWith(
      "Command completed",
      expect.objectContaining({
        extra: expect.objectContaining({ durationMs: expect.any(Number) }),
      }),
    );
  });

  it("logs which middleware blocked the command", async () => {
    const context = createMockMiddlewareContext();
    const handler = vi.fn();

    await RunMiddlewareChain([LoggingMiddleware, Blocker], context, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(context.run.blockedBy).toBe("blocker");
    expect(context.logger.Info).toHaveBeenCalledWith(
      "Command blocked",
      expect.objectContaining({
        extra: expect.objectContaining({ blockedBy: "blocker" }),
      }),
    );
  });

  it("logs and rethrows handler errors", async () => {
    const context = createMockMiddlewareContext();

    await expect(
      RunMiddlewareChain([LoggingMiddleware], context, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(context.logger.Warn).toHaveBeenCalledWith(
      "Command threw",
      expect.anything(),
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { RunMessageCreateHandlers } from "@events/MessageCreate/RunMessageCreateHandlers";
import type { MessageCreateHandler } from "@events/MessageCreate/types";
import { createMockLogger } from "../../helpers";

describe("RunMessageCreateHandlers", () => {
  it("stops the chain when a handler returns stop", async () => {
    const first: MessageCreateHandler = {
      name: "first",
      execute: vi.fn().mockResolvedValue("stop"),
    };
    const second: MessageCreateHandler = {
      name: "second",
      execute: vi.fn().mockResolvedValue("continue"),
    };

    const context = {
      logger: createMockLogger(),
    } as never;
    const msg = { guild: { id: "guild-1" } } as never;

    await RunMessageCreateHandlers(context, msg, [first, second]);

    expect(first.execute).toHaveBeenCalledWith(context, msg);
    expect(second.execute).not.toHaveBeenCalled();
  });

  it("runs handlers in order until all continue", async () => {
    const order: string[] = [];
    const first: MessageCreateHandler = {
      name: "first",
      execute: vi.fn().mockImplementation(async () => {
        order.push("first");
        return "continue";
      }),
    };
    const second: MessageCreateHandler = {
      name: "second",
      execute: vi.fn().mockImplementation(async () => {
        order.push("second");
        return "continue";
      }),
    };

    const context = {
      logger: createMockLogger(),
    } as never;
    const msg = { guild: { id: "guild-1" } } as never;

    await RunMessageCreateHandlers(context, msg, [first, second]);

    expect(order).toEqual(["first", "second"]);
  });

  it("logs handler failures and continues the chain", async () => {
    const logger = createMockLogger();
    const failing: MessageCreateHandler = {
      name: "failing",
      execute: vi.fn().mockRejectedValue(new Error("handler failed")),
    };
    const next: MessageCreateHandler = {
      name: "next",
      execute: vi.fn().mockResolvedValue("continue"),
    };

    const context = { logger } as never;
    const msg = { guild: { id: "guild-1" } } as never;

    await RunMessageCreateHandlers(context, msg, [failing, next]);

    expect(logger.Error).toHaveBeenCalledWith(
      "MessageCreate handler failed",
      expect.objectContaining({
        extra: { handler: "failing" },
      }),
    );
    expect(next.execute).toHaveBeenCalled();
  });
});

import { MessageFlags } from "discord.js";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  AUTO_DEFER_AFTER_MS,
  AutoDeferMiddleware,
} from "@middleware/AutoDeferMiddleware";
import { createMockMiddlewareContext } from "../../helpers";

describe("AutoDeferMiddleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defers when the handler is still running at the deadline", async () => {
    const context = createMockMiddlewareContext({
      config: { autoDefer: { ephemeral: true } },
    });
    let finish: () => void = () => undefined;
    const next = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    const run = AutoDeferMiddleware.execute(context, next);
    await vi.advanceTimersByTimeAsync(AUTO_DEFER_AFTER_MS);
    finish();
    await run;

    expect(context.responders.interactionResponder.Defer).toHaveBeenCalledWith(
      context.interaction,
      { flags: MessageFlags.Ephemeral },
    );
  });

  it("does not defer a handler that finishes in time", async () => {
    const context = createMockMiddlewareContext({
      config: { autoDefer: { ephemeral: false } },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await AutoDeferMiddleware.execute(context, next);
    await vi.advanceTimersByTimeAsync(AUTO_DEFER_AFTER_MS * 2);

    expect(
      context.responders.interactionResponder.Defer,
    ).not.toHaveBeenCalled();
  });

  it("does not defer once the handler has replied", async () => {
    const context = createMockMiddlewareContext({
      config: { autoDefer: { ephemeral: false } },
    });
    let finish: () => void = () => undefined;
    const next = vi.fn(async () => {
      await context.interaction.reply({ content: "fast" });
      await new Promise<void>((resolve) => (finish = resolve));
    });

    const run = AutoDeferMiddleware.execute(context, next);
    await vi.advanceTimersByTimeAsync(AUTO_DEFER_AFTER_MS);
    finish();
    await run;

    expect(
      context.responders.interactionResponder.Defer,
    ).not.toHaveBeenCalled();
  });
});

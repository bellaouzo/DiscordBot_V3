import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { ErrorMiddleware } from "@middleware/ErrorMiddleware";
import {
  createMockInteraction,
  createMockContext,
  createMockLogger,
  createMockResponderSet,
} from "../../helpers";
import type { MiddlewareContext } from "@middleware";

function createMiddlewareContext(): MiddlewareContext {
  const interaction = createMockInteraction({
    user: { id: "user-1", username: "TestUser" },
  });
  const context = createMockContext();
  const command = {
    data: { name: "test", description: "Test" },
    group: "utility",
    execute: vi.fn().mockResolvedValue(undefined),
  };

  return {
    interaction,
    command,
    logger: createMockLogger(),
    responders: createMockResponderSet(),
    config: {},
    databases: context.databases,
    appConfig: context.appConfig,
  } as unknown as MiddlewareContext;
}

describe("ErrorMiddleware", () => {
  it("logs and replies when next throws", async () => {
    const context = createMiddlewareContext();
    const next = vi.fn().mockRejectedValue(new Error("boom"));

    await ErrorMiddleware.execute(context, next);

    expect(context.logger.Error).toHaveBeenCalledWith(
      "Command execution failed",
      expect.objectContaining({
        command: "test",
        error: expect.objectContaining({ message: "boom" }),
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
        embeds: expect.any(Array),
      }),
    );
  });

  it("edits reply when interaction was already deferred", async () => {
    const context = createMiddlewareContext();
    Object.defineProperty(context.interaction, "deferred", {
      value: true,
      configurable: true,
    });
    const next = vi.fn().mockRejectedValue(new Error("boom"));

    await ErrorMiddleware.execute(context, next);

    expect(context.responders.interactionResponder.Edit).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        embeds: expect.any(Array),
      }),
    );
    expect(
      context.responders.interactionResponder.Reply,
    ).not.toHaveBeenCalled();
  });
});

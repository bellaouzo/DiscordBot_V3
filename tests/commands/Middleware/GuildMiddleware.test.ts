import { describe, it, expect, vi } from "vitest";
import { GuildMiddleware } from "@middleware/GuildMiddleware";
import {
  createMockInteraction,
  createMockContext,
  createMockLogger,
  createMockResponderSet,
} from "../../helpers";
import type { MiddlewareContext } from "@middleware";

function createMiddlewareContext(overrides: {
  guild?: unknown;
}): MiddlewareContext {
  const interaction = createMockInteraction({
    guild: overrides.guild ?? null,
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
    config: { guildOnly: true },
    databases: context.databases,
    appConfig: context.appConfig,
  } as unknown as MiddlewareContext;
}

describe("GuildMiddleware", () => {
  it("has name guild-only", () => {
    expect(GuildMiddleware.name).toBe("guild-only");
  });

  it("replies with Guild Only and does not call next when interaction has no guild", async () => {
    const context = createMiddlewareContext({ guild: null });
    const next = vi.fn().mockResolvedValue(undefined);

    await GuildMiddleware.execute(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      context.interaction,
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Guild Only"),
            description: expect.stringContaining("server"),
          }),
        ]),
      })
    );
  });

  it("calls next when interaction has guild", async () => {
    const context = createMiddlewareContext({
      guild: { id: "guild-1", name: "Test Guild" },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await GuildMiddleware.execute(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(
      context.responders.interactionResponder.Reply
    ).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { FeatureEnabledMiddleware } from "@middleware/FeatureEnabledMiddleware";
import type { MiddlewareContext } from "@middleware";
import {
  createMockContext,
  createMockInteraction,
  createMockLogger,
  createMockResponderSet,
} from "../../helpers";
import { EconomyCommand } from "@commands/Fun/EconomyCommand";

describe("FeatureEnabledMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks economy commands when economy is disabled", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as never,
    });
    const responders = createMockResponderSet();
    const context = createMockContext({ responders });
    context.databases.serverDb.GetGuildSettings = vi.fn().mockReturnValue({
      guild_id: "guild-1",
      economy_enabled: false,
      giveaways_enabled: true,
    });

    const middlewareContext = {
      interaction,
      command: EconomyCommand,
      logger: createMockLogger(),
      responders,
      config: EconomyCommand.config!,
      databases: context.databases,
      appConfig: context.appConfig,
    } as unknown as MiddlewareContext;

    const next = vi.fn().mockResolvedValue(undefined);
    await FeatureEnabledMiddleware.execute(middlewareContext, next);

    expect(next).not.toHaveBeenCalled();
    expect(responders.interactionResponder.Reply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it("allows economy commands when economy is enabled", async () => {
    const interaction = createMockInteraction({
      guild: { id: "guild-1" } as never,
    });
    const responders = createMockResponderSet();
    const context = createMockContext({ responders });
    context.databases.serverDb.GetGuildSettings = vi.fn().mockReturnValue({
      guild_id: "guild-1",
      economy_enabled: true,
      giveaways_enabled: true,
    });

    const middlewareContext = {
      interaction,
      command: EconomyCommand,
      logger: createMockLogger(),
      responders,
      config: EconomyCommand.config!,
      databases: context.databases,
      appConfig: context.appConfig,
    } as unknown as MiddlewareContext;

    const next = vi.fn().mockResolvedValue(undefined);
    await FeatureEnabledMiddleware.execute(middlewareContext, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

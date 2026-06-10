import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import { createMockLogger } from "../helpers";

function createUserSelectInteraction(overrides?: {
  customId?: string;
  userId?: string;
}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  return {
    customId: overrides?.customId ?? "user-select:test",
    user: { id: overrides?.userId ?? "user-1" },
    reply,
  };
}

describe("UserSelectMenuRouter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for unknown custom IDs", async () => {
    const router = new UserSelectMenuRouter(createMockLogger());
    const handled = await router.HandleUserSelectMenu(
      createUserSelectInteraction() as never,
    );
    expect(handled).toBe(false);
  });

  it("rejects interactions from non-owners", async () => {
    const router = new UserSelectMenuRouter(createMockLogger());
    const { customId } = router.RegisterUserSelectMenu({
      ownerId: "owner-1",
      handler: vi.fn(),
    });

    const interaction = createUserSelectInteraction({
      customId,
      userId: "other-user",
    });
    const handled = await router.HandleUserSelectMenu(interaction as never);

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This interaction is not for you.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("replies when registration expired", async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const router = new UserSelectMenuRouter(createMockLogger());
    const { customId } = router.RegisterUserSelectMenu({
      ownerId: "user-1",
      handler: vi.fn(),
      expiresInMs: 1000,
      onExpire,
    });

    vi.advanceTimersByTime(1500);

    const interaction = createUserSelectInteraction({ customId });
    const handled = await router.HandleUserSelectMenu(interaction as never);

    expect(handled).toBe(true);
    expect(onExpire).toHaveBeenCalledOnce();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This interaction has expired.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("disposes single-use menus after successful handling", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const onExpire = vi.fn();
    const router = new UserSelectMenuRouter(createMockLogger());
    const { customId, dispose } = router.RegisterUserSelectMenu({
      ownerId: "user-1",
      handler,
      singleUse: true,
      onExpire,
    });

    await router.HandleUserSelectMenu(
      createUserSelectInteraction({ customId }) as never,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(router.GetMenuCount()).toBe(0);
    dispose();
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("logs handler errors and replies safely", async () => {
    const logger = createMockLogger();
    const router = new UserSelectMenuRouter(logger);
    const { customId } = router.RegisterUserSelectMenu({
      ownerId: "user-1",
      handler: vi.fn().mockRejectedValue(new Error("handler failed")),
    });

    const interaction = createUserSelectInteraction({ customId });
    const handled = await router.HandleUserSelectMenu(interaction as never);

    expect(handled).toBe(true);
    expect(logger.Error).toHaveBeenCalledWith(
      "User select menu handler error",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "An error occurred while processing your request.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("cleans up expired menus", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const router = new UserSelectMenuRouter(createMockLogger());
    router.RegisterUserSelectMenu({
      ownerId: "user-1",
      handler: vi.fn(),
      expiresInMs: 500,
      onExpire,
    });

    vi.advanceTimersByTime(600);
    router.CleanupExpiredMenus();

    expect(router.GetMenuCount()).toBe(0);
    expect(onExpire).toHaveBeenCalledOnce();
  });
});

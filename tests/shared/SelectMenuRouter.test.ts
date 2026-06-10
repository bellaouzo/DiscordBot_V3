import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { SelectMenuRouter } from "@shared/SelectMenuRouter";
import { createMockLogger } from "../helpers";

function createSelectInteraction(overrides?: {
  customId?: string;
  userId?: string;
  deferred?: boolean;
  replied?: boolean;
}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  return {
    customId: overrides?.customId ?? "select:test",
    user: { id: overrides?.userId ?? "user-1" },
    deferred: overrides?.deferred ?? false,
    replied: overrides?.replied ?? false,
    reply,
  };
}

describe("SelectMenuRouter", () => {
  it("returns false for unknown menus", async () => {
    const router = new SelectMenuRouter(createMockLogger());
    const handled = await router.HandleSelectMenu(
      createSelectInteraction() as never,
    );
    expect(handled).toBe(false);
  });

  it("replies when menu registration expired", async () => {
    const onExpire = vi.fn();
    const router = new SelectMenuRouter(createMockLogger());
    router.RegisterSelectMenu({
      customId: "select:expired",
      expiresInMs: -1,
      onExpire,
      handler: vi.fn(),
    });

    const interaction = createSelectInteraction({ customId: "select:expired" });
    const handled = await router.HandleSelectMenu(interaction as never);

    expect(handled).toBe(true);
    expect(onExpire).toHaveBeenCalledOnce();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This interaction has expired.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("rejects interactions from non-owners", async () => {
    const router = new SelectMenuRouter(createMockLogger());
    router.RegisterSelectMenu({
      customId: "select:owned",
      ownerId: "owner-1",
      handler: vi.fn(),
    });

    const interaction = createSelectInteraction({
      customId: "select:owned",
      userId: "other-user",
    });
    const handled = await router.HandleSelectMenu(interaction as never);

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "You cannot use this interaction.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("skips reply when interaction is already replied", async () => {
    const router = new SelectMenuRouter(createMockLogger());
    router.RegisterSelectMenu({
      customId: "select:replied",
      handler: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const interaction = createSelectInteraction({
      customId: "select:replied",
      replied: true,
    });
    await router.HandleSelectMenu(interaction as never);

    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("disposes single-use menus after successful handling", async () => {
    const handler = vi.fn();
    const onExpire = vi.fn();
    const router = new SelectMenuRouter(createMockLogger());
    const { dispose } = router.RegisterSelectMenu({
      customId: "select:single",
      handler,
      singleUse: true,
      onExpire,
    });

    await router.HandleSelectMenu(
      createSelectInteraction({ customId: "select:single" }) as never,
    );

    expect(handler).toHaveBeenCalledOnce();
    dispose();
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("logs handler failures and replies safely", async () => {
    const logger = createMockLogger();
    const router = new SelectMenuRouter(logger);
    router.RegisterSelectMenu({
      customId: "select:error",
      handler: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const interaction = createSelectInteraction({ customId: "select:error" });
    const handled = await router.HandleSelectMenu(interaction as never);

    expect(handled).toBe(true);
    expect(logger.Error).toHaveBeenCalledWith(
      "Select menu handler failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "Something went wrong while handling that interaction.",
      flags: MessageFlags.Ephemeral,
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { ComponentRouter } from "@shared/ComponentRouter";
import { createMockLogger } from "../helpers";

function createButtonInteraction(overrides?: {
  customId?: string;
  userId?: string;
  deferred?: boolean;
  replied?: boolean;
}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  return {
    customId: overrides?.customId ?? "button:test",
    user: { id: overrides?.userId ?? "user-1" },
    deferred: overrides?.deferred ?? false,
    replied: overrides?.replied ?? false,
    reply,
  };
}

describe("ComponentRouter", () => {
  it("returns false for unknown buttons", async () => {
    const router = new ComponentRouter(createMockLogger());
    const handled = await router.HandleButton(
      createButtonInteraction() as never,
    );
    expect(handled).toBe(false);
  });

  it("matches the longest prefix registration", async () => {
    const router = new ComponentRouter(createMockLogger());
    const shortHandler = vi.fn();
    const longHandler = vi.fn();

    router.RegisterButtonPrefix("ticket:", { handler: shortHandler });
    router.RegisterButtonPrefix("ticket:claim:", { handler: longHandler });

    const handled = await router.HandleButton(
      createButtonInteraction({ customId: "ticket:claim:12" }) as never,
    );

    expect(handled).toBe(true);
    expect(longHandler).toHaveBeenCalled();
    expect(shortHandler).not.toHaveBeenCalled();
  });

  it("replies when button registration expired", async () => {
    const onExpire = vi.fn();
    const router = new ComponentRouter(createMockLogger());
    router.RegisterButton({
      customId: "button:expired",
      expiresInMs: -1,
      onExpire,
      handler: vi.fn(),
    });

    const interaction = createButtonInteraction({ customId: "button:expired" });
    const handled = await router.HandleButton(interaction as never);

    expect(handled).toBe(true);
    expect(onExpire).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This interaction has expired.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("rejects interactions from non-owners", async () => {
    const router = new ComponentRouter(createMockLogger());
    router.RegisterButton({
      customId: "button:owned",
      ownerId: "owner-1",
      handler: vi.fn(),
    });

    const interaction = createButtonInteraction({
      customId: "button:owned",
      userId: "other-user",
    });
    const handled = await router.HandleButton(interaction as never);

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "You cannot use this interaction.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("skips reply when interaction is already deferred", async () => {
    const router = new ComponentRouter(createMockLogger());
    router.RegisterButton({
      customId: "button:deferred",
      handler: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const interaction = createButtonInteraction({
      customId: "button:deferred",
      deferred: true,
    });
    await router.HandleButton(interaction as never);

    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("disposes single-use buttons after successful handling", async () => {
    const handler = vi.fn();
    const onExpire = vi.fn();
    const router = new ComponentRouter(createMockLogger());
    const { dispose } = router.RegisterButton({
      customId: "button:single",
      handler,
      singleUse: true,
      onExpire,
    });

    await router.HandleButton(
      createButtonInteraction({ customId: "button:single" }) as never,
    );

    expect(handler).toHaveBeenCalledOnce();
    dispose();
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("logs handler failures and replies safely", async () => {
    const logger = createMockLogger();
    const router = new ComponentRouter(logger);
    router.RegisterButton({
      customId: "button:error",
      handler: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const interaction = createButtonInteraction({ customId: "button:error" });
    const handled = await router.HandleButton(interaction as never);

    expect(handled).toBe(true);
    expect(logger.Error).toHaveBeenCalledWith(
      "Button handler failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "Something went wrong while handling that interaction.",
      flags: MessageFlags.Ephemeral,
    });
  });
});

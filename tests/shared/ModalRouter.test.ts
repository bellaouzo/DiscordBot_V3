import { describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { ModalRouter } from "@shared/ModalRouter";
import { createMockLogger } from "../helpers";

function createModalInteraction(overrides?: {
  customId?: string;
  userId?: string;
  deferred?: boolean;
  replied?: boolean;
}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  return {
    customId: overrides?.customId ?? "modal:test",
    user: { id: overrides?.userId ?? "user-1" },
    deferred: overrides?.deferred ?? false,
    replied: overrides?.replied ?? false,
    reply,
  };
}

describe("ModalRouter", () => {
  it("returns false for unknown modal custom IDs", async () => {
    const router = new ModalRouter(createMockLogger());
    const handled = await router.HandleModal(createModalInteraction() as never);
    expect(handled).toBe(false);
  });

  it("replies when modal registration expired", async () => {
    const onExpire = vi.fn();
    const router = new ModalRouter(createMockLogger());
    router.RegisterModal({
      customId: "modal:expired",
      expiresInMs: -1,
      onExpire,
      handler: vi.fn(),
    });

    const interaction = createModalInteraction({ customId: "modal:expired" });
    const handled = await router.HandleModal(interaction as never);

    expect(handled).toBe(true);
    expect(onExpire).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This interaction has expired.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("rejects interactions from non-owners", async () => {
    const router = new ModalRouter(createMockLogger());
    router.RegisterModal({
      customId: "modal:owned",
      ownerId: "owner-1",
      handler: vi.fn(),
    });

    const interaction = createModalInteraction({
      customId: "modal:owned",
      userId: "other-user",
    });
    const handled = await router.HandleModal(interaction as never);

    expect(handled).toBe(true);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "You cannot use this interaction.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("runs handler and disposes single-use modals", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const onExpire = vi.fn();
    const router = new ModalRouter(createMockLogger());
    router.RegisterModal({
      customId: "modal:single",
      singleUse: true,
      onExpire,
      handler,
    });

    const interaction = createModalInteraction({ customId: "modal:single" });
    const handled = await router.HandleModal(interaction as never);

    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledWith(interaction);
    expect(onExpire).toHaveBeenCalled();

    const secondHandle = await router.HandleModal(interaction as never);
    expect(secondHandle).toBe(false);
  });

  it("logs handler failures and replies safely", async () => {
    const logger = createMockLogger();
    const router = new ModalRouter(logger);
    router.RegisterModal({
      customId: "modal:error",
      handler: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const interaction = createModalInteraction({ customId: "modal:error" });
    const handled = await router.HandleModal(interaction as never);

    expect(handled).toBe(true);
    expect(logger.Error).toHaveBeenCalledWith(
      "Modal handler failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "Something went wrong while handling that interaction.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("skips reply when interaction already deferred", async () => {
    const router = new ModalRouter(createMockLogger());
    router.RegisterModal({
      customId: "modal:owned",
      ownerId: "owner-1",
      handler: vi.fn(),
    });

    const interaction = createModalInteraction({
      customId: "modal:owned",
      userId: "other-user",
      deferred: true,
    });
    await router.HandleModal(interaction as never);

    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

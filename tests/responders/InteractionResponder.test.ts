import { describe, expect, it, vi } from "vitest";
import { InteractionResponder } from "@responders/InteractionResponder";
import { createMockLogger } from "../helpers";

function createInteraction(overrides?: {
  replied?: boolean;
  deferred?: boolean;
}) {
  let replied = overrides?.replied ?? false;
  const reply = vi.fn().mockImplementation(async () => {
    replied = true;
  });
  const editReply = vi.fn().mockResolvedValue(undefined);
  return {
    get replied() {
      return replied;
    },
    get deferred() {
      return overrides?.deferred ?? false;
    },
    reply,
    editReply,
  };
}

describe("InteractionResponder", () => {
  it("returns failure when replying to an already replied interaction", async () => {
    const responder = new InteractionResponder(createMockLogger());
    const interaction = createInteraction({ replied: true });

    const result = await responder.Reply(interaction as never, {
      content: "hello",
    });

    expect(result).toEqual({
      success: false,
      message: "Already replied to this interaction",
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("returns failure when editing before a reply exists", async () => {
    const responder = new InteractionResponder(createMockLogger());
    const interaction = createInteraction();

    const result = await responder.Edit(interaction as never, {
      content: "updated",
    });

    expect(result).toEqual({
      success: false,
      message: "No reply to edit",
    });
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it("logs and returns failure when reply throws", async () => {
    const logger = createMockLogger();
    const responder = new InteractionResponder(logger);
    const interaction = createInteraction();
    interaction.reply.mockRejectedValue(new Error("api down"));

    const result = await responder.Reply(interaction as never, {
      content: "hello",
    });

    expect(result.success).toBe(false);
    expect(logger.Error).toHaveBeenCalledWith(
      "Reply failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("runs WithAction and edits follow-up content", async () => {
    const responder = new InteractionResponder(createMockLogger());
    const interaction = createInteraction();
    const action = vi.fn().mockResolvedValue(undefined);

    await responder.WithAction({
      interaction: interaction as never,
      message: "Working...",
      action,
      followUp: "Done!",
    });

    expect(action).toHaveBeenCalledOnce();
    expect(interaction.reply).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledWith({ content: "Done!" });
  });
});

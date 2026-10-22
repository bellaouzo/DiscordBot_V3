import { describe, expect, it, vi } from "vitest";
import type { ModalSubmitInteraction } from "discord.js";
import { WarnUserMenu } from "@commands/Moderation/WarnCommand";
import { MuteUserMenu } from "@commands/Moderation/MuteCommand";
import { PromptModal } from "@shared/ModalPrompt";
import type { ModalRouter } from "@shared/ModalRouter";
import { createMockContext } from "../../helpers";

function CreateMenuInteraction() {
  return {
    id: "interaction-1",
    user: { id: "mod-1", username: "Mod" },
    guild: { id: "guild-1", name: "Guild" },
    targetUser: { id: "target-1", username: "Target", tag: "Target#0001" },
    showModal: vi.fn().mockResolvedValue(undefined),
  };
}

function CreateSubmit(values: Record<string, string>) {
  return {
    user: { id: "mod-1" },
    guild: { id: "guild-1", name: "Guild" },
    replied: false,
    deferred: false,
    fields: { getTextInputValue: (id: string) => values[id] ?? "" },
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ModalSubmitInteraction;
}

/** The handler PromptModal registered with the modal router. */
function RegisteredModalHandler(context: ReturnType<typeof createMockContext>) {
  const registerModal = context.responders.modalRouter
    .RegisterModal as ReturnType<typeof vi.fn>;
  return registerModal.mock.calls[0][0] as {
    customId: string;
    ownerId: string;
    handler: (submit: ModalSubmitInteraction) => Promise<void>;
  };
}

describe("PromptModal", () => {
  it("shows a modal owned by the user and passes trimmed values to onSubmit", async () => {
    const interaction = CreateMenuInteraction();
    const modalRouter = { RegisterModal: vi.fn() };
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    await PromptModal({
      interaction: interaction as never,
      modalRouter: modalRouter as unknown as ModalRouter,
      title: "Test",
      fields: [{ id: "reason", label: "Reason" }],
      onSubmit,
    });

    expect(interaction.showModal).toHaveBeenCalledOnce();
    const registration = modalRouter.RegisterModal.mock.calls[0][0];
    expect(registration.ownerId).toBe("mod-1");
    expect(registration.customId).toBe("prompt:interaction-1");

    const submit = CreateSubmit({ reason: "  spam  " });
    await registration.handler(submit);
    expect(onSubmit).toHaveBeenCalledWith(submit, { reason: "spam" });
  });

  it("replaces a hanging reply when the action fails", async () => {
    const modalRouter = { RegisterModal: vi.fn() };
    await PromptModal({
      interaction: CreateMenuInteraction() as never,
      modalRouter: modalRouter as unknown as ModalRouter,
      title: "Test",
      fields: [],
      onSubmit: async () => {
        throw new Error("missing permissions");
      },
    });

    const submit = CreateSubmit({});
    (submit as unknown as { replied: boolean }).replied = true;

    await expect(
      modalRouter.RegisterModal.mock.calls[0][0].handler(submit),
    ).rejects.toThrow("missing permissions");
    expect(submit.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: "Action Failed" })],
      }),
    );
  });
});

describe("Warn user menu", () => {
  it("inherits /warn add's mod access", () => {
    expect(WarnUserMenu.config.access).toBe("mod");
    expect(WarnUserMenu.linked).toEqual({ command: "warn", subcommand: "add" });
  });

  it("asks for a reason, then records the warning", async () => {
    const context = createMockContext();
    vi.mocked(context.databases.userDb.GetWarnings).mockReturnValue([
      { id: 1 },
    ] as never);
    vi.mocked(context.databases.userDb.AddWarning).mockReturnValue({
      id: 1,
      reason: "spam",
    } as never);

    await WarnUserMenu.execute(CreateMenuInteraction() as never, context);
    const submit = CreateSubmit({ reason: "spam" });
    await RegisteredModalHandler(context).handler(submit);

    expect(context.databases.userDb.AddWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-1",
        moderator_id: "mod-1",
        reason: "spam",
      }),
    );
    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      submit,
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: "⚠️ Warning Added" })],
      }),
    );
  });
});

describe("Mute user menu", () => {
  it("rejects a duration it can't parse", async () => {
    const context = createMockContext();

    await MuteUserMenu.execute(CreateMenuInteraction() as never, context);
    const submit = CreateSubmit({ duration: "forever", reason: "" });
    await RegisteredModalHandler(context).handler(submit);

    expect(context.responders.interactionResponder.Reply).toHaveBeenCalledWith(
      submit,
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: "Invalid Duration" })],
      }),
    );
    expect(
      context.responders.interactionResponder.WithAction,
    ).not.toHaveBeenCalled();
  });
});

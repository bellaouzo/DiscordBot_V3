import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ModalRouter } from "./ModalRouter";
import { EmbedFactory } from "@utilities/EmbedFactory";

/** One text input in a modal. */
export interface ModalField {
  /** Key the submitted value is returned under. */
  readonly id: string;
  readonly label: string;
  readonly required?: boolean;
  /** `"paragraph"` for multi-line input. Default `"short"`. */
  readonly style?: "short" | "paragraph";
  readonly placeholder?: string;
  readonly maxLength?: number;
}

/** Interactions that can open a modal (it must be their first response). */
export type ModalOpeningInteraction =
  | ChatInputCommandInteraction
  | ContextMenuCommandInteraction
  | ButtonInteraction;

const MODAL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Shows a modal and calls `onSubmit` with the trimmed values when the same user submits it.
 * The modal must be the interaction's first response, so don't use this after deferring.
 *
 * @example
 * await PromptModal({
 *   interaction,
 *   modalRouter: context.responders.modalRouter,
 *   title: `Warn ${user.username}`,
 *   fields: [{ id: "reason", label: "Reason", style: "paragraph" }],
 *   onSubmit: (submit, values) => WarnUser({ interaction: submit, reason: values.reason }),
 * });
 */
export async function PromptModal(options: {
  readonly interaction: ModalOpeningInteraction;
  readonly modalRouter: ModalRouter;
  readonly title: string;
  readonly fields: readonly ModalField[];
  readonly onSubmit: (
    submit: ModalSubmitInteraction,
    values: Readonly<Record<string, string>>,
  ) => Promise<void>;
}): Promise<void> {
  const customId = `prompt:${options.interaction.id}`;

  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(options.title.slice(0, 45));

  for (const field of options.fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setRequired(field.required ?? false)
      .setStyle(
        field.style === "paragraph"
          ? TextInputStyle.Paragraph
          : TextInputStyle.Short,
      );
    if (field.placeholder) {
      input.setPlaceholder(field.placeholder);
    }
    if (field.maxLength) {
      input.setMaxLength(field.maxLength);
    }
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );
  }

  options.modalRouter.RegisterModal({
    customId,
    ownerId: options.interaction.user.id,
    expiresInMs: MODAL_TIMEOUT_MS,
    singleUse: true,
    handler: async (submit) => {
      const values: Record<string, string> = {};
      for (const field of options.fields) {
        values[field.id] = submit.fields.getTextInputValue(field.id).trim();
      }

      try {
        await options.onSubmit(submit, values);
      } catch (error) {
        // Don't leave a "Processing..." reply hanging; the router logs the error and answers
        // when nothing was sent yet.
        if (submit.replied || submit.deferred) {
          await submit
            .editReply({
              content: "",
              embeds: [
                EmbedFactory.CreateError({
                  title: "Action Failed",
                  description:
                    "Something went wrong. Check my role is above the target's and that I have the needed permissions.",
                }).toJSON(),
              ],
              components: [],
            })
            .catch(() => undefined);
        }
        throw error;
      }
    },
  });

  await options.interaction.showModal(modal);
}

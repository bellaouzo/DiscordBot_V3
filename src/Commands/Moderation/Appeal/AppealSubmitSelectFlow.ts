import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Guild,
} from "discord.js";
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { CommandContext } from "@commands";
import type { AppealableActionOption } from "@utilities";
import { EmbedFactory } from "@utilities";
import { ParseActionOptionValue } from "@commands/Moderation/Appeal/AppealShared";
import { ProcessAppealSubmission } from "@commands/Moderation/Appeal/AppealSubmitModalFlow";

const APPEAL_SELECT_TIMEOUT_MS = 1000 * 60 * 5;
const APPEAL_MODAL_TIMEOUT_MS = 1000 * 60 * 10;

export type AppealStartInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction;

export function RegisterAppealSelectFlow(data: {
  interaction: AppealStartInteraction;
  context: CommandContext;
  guild: Guild;
  flowInteractionId: string;
  options: AppealableActionOption[];
}): void {
  const { interaction, context, guild, flowInteractionId, options } = data;
  const { selectMenuRouter, modalRouter } = context.responders;

  const customId = `appeal-select:${flowInteractionId}`;

  selectMenuRouter.RegisterSelectMenu({
    customId,
    ownerId: interaction.user.id,
    singleUse: true,
    expiresInMs: APPEAL_SELECT_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      try {
        const parsed = ParseActionOptionValue(selectInteraction.values[0]);
        if (!parsed) {
          await selectInteraction.reply({
            embeds: [
              EmbedFactory.CreateError({
                title: "Invalid Selection",
                description: "Could not parse the selected action.",
              }).toJSON(),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const chosen = options.find(
          (entry) =>
            entry.actionType === parsed.actionType &&
            entry.actionRef === parsed.actionRef,
        );
        if (!chosen) {
          await selectInteraction.reply({
            embeds: [
              EmbedFactory.CreateWarning({
                title: "Selection Expired",
                description: "That moderation action is no longer available.",
              }).toJSON(),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const modalCustomId = `appeal-reason:${flowInteractionId}:${chosen.actionType}:${chosen.actionRef}`;
        const modal = new ModalBuilder()
          .setCustomId(modalCustomId)
          .setTitle("Submit Appeal");
        const reasonInput = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Why should this action be appealed?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);
        const evidenceInput = new TextInputBuilder()
          .setCustomId("evidence")
          .setLabel("Evidence (optional)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000);
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput),
        );

        modalRouter.RegisterModal({
          customId: modalCustomId,
          ownerId: interaction.user.id,
          singleUse: true,
          expiresInMs: APPEAL_MODAL_TIMEOUT_MS,
          handler: async (modalInteraction) => {
            const reason = modalInteraction.fields
              .getTextInputValue("reason")
              .trim();
            const evidenceRaw = modalInteraction.fields
              .getTextInputValue("evidence")
              .trim();
            const evidence = evidenceRaw.length > 0 ? evidenceRaw : null;

            await modalInteraction.deferReply({
              flags: MessageFlags.Ephemeral,
            });

            try {
              await ProcessAppealSubmission({
                modalInteraction,
                context,
                guild,
                reason,
                evidence,
                target: chosen,
              });
            } catch (error) {
              context.logger.Error("Appeal submission failed", {
                error,
                extra: {
                  guildId: guild.id,
                  userId: modalInteraction.user.id,
                  actionType: chosen.actionType,
                  actionRef: chosen.actionRef,
                },
              });
              await modalInteraction.editReply({
                embeds: [
                  EmbedFactory.CreateError({
                    title: "Appeal Failed",
                    description:
                      "We could not complete your appeal submission. Please try again shortly.",
                  }).toJSON(),
                ],
              });
            }
          },
        });

        await selectInteraction.showModal(modal);
      } catch (error) {
        context.logger.Error("Failed to continue appeal submit flow", {
          error,
          extra: {
            guildId: guild.id,
            userId: interaction.user.id,
          },
        });
        if (selectInteraction.replied || selectInteraction.deferred) {
          await selectInteraction.followUp({
            embeds: [
              EmbedFactory.CreateError({
                title: "Appeal Flow Error",
                description:
                  "The appeal form could not be opened. Please run the command again.",
              }).toJSON(),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await selectInteraction.reply({
          embeds: [
            EmbedFactory.CreateError({
              title: "Appeal Flow Error",
              description:
                "The appeal form could not be opened. Please run the command again.",
            }).toJSON(),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
    },
  });
}

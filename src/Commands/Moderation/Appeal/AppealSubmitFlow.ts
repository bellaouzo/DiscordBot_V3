import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Guild,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { CommandContext } from "@commands";
import { Appeal, AppealActionType } from "@database";
import {
  AppealableActionOption,
  ComponentFactory,
  CreateAppealManager,
  CreateChannelManager,
  EmbedFactory,
  ToActionRowData,
} from "@utilities";
import {
  BuildActionSelectOptions,
  ParseActionOptionValue,
} from "@commands/Moderation/Appeal/AppealShared";
import { BuildAppealReviewEmbed } from "@commands/Moderation/Appeal/AppealFormatters";
import { HandleAppealDecisionButton } from "@commands/Moderation/Appeal/AppealReviewFlow";

const APPEAL_SELECT_TIMEOUT_MS = 1000 * 60 * 5;
const APPEAL_MODAL_TIMEOUT_MS = 1000 * 60 * 10;

type AppealStartInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function CreateAppealReviewChannel(data: {
  guild: Guild;
  requesterId: string;
  requesterUsername: string;
  context: CommandContext;
  appeal: Appeal;
  contextLine: string;
}): Promise<{ channel: TextChannel } | null> {
  const { guild, context, requesterId, requesterUsername, appeal, contextLine } =
    data;
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const channelManager = CreateChannelManager({ guild, logger: context.logger });
  const fallbackCategory = await channelManager.GetOrCreateCategory("Appeals");

  let parentCategoryId =
    settings?.appeal_review_category_id ?? fallbackCategory?.id ?? null;
  if (parentCategoryId) {
    const parent = guild.channels.cache.get(parentCategoryId);
    if (!parent || parent.type !== ChannelType.GuildCategory) {
      parentCategoryId = fallbackCategory?.id ?? null;
    }
  }

  const botMember = await guild.members.fetchMe();
  const requesterMember = await guild.members.fetch(requesterId).catch(() => null);

  const permissionOverwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (requesterMember) {
    permissionOverwrites.push({
      id: requesterMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const reviewerRoleIds = new Set([
    ...(settings?.admin_role_ids ?? []),
    ...(settings?.mod_role_ids ?? []),
  ]);
  reviewerRoleIds.forEach((roleId) => {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  });

  const safeUsername = requesterUsername
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 20);
  const channel = await guild.channels
    .create({
      name: `appeal-${appeal.id}-${safeUsername || "user"}`,
      type: ChannelType.GuildText,
      parent: parentCategoryId,
      permissionOverwrites,
      topic: `Appeal #${appeal.id} | ${contextLine}`,
    })
    .catch(() => null);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return null;
  }

  return { channel };
}

async function ProcessAppealSubmission(data: {
  modalInteraction: ModalSubmitInteraction;
  context: CommandContext;
  guild: Guild;
  reason: string;
  evidence: string | null;
  target: AppealableActionOption;
}): Promise<void> {
  const { modalInteraction, context, guild, reason, evidence, target } = data;
  const { componentRouter } = context.responders;

  const appealManager = CreateAppealManager({
    guildId: guild.id,
    userId: modalInteraction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const validation = appealManager.ValidateTarget({
    actionType: target.actionType,
    actionRef: target.actionRef,
  });
  if (!validation.success || !validation.target) {
    await modalInteraction.editReply({
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Unable to Submit Appeal",
          description: validation.message ?? "Could not validate selected action.",
        }).toJSON(),
      ],
    });
    return;
  }

  const appeal = appealManager.CreateAppeal({
    actionType: validation.target.actionType,
    actionRef: validation.target.actionRef,
    reason,
    evidence,
  });

  const createdReview = await CreateAppealReviewChannel({
    guild,
    requesterId: modalInteraction.user.id,
    requesterUsername: modalInteraction.user.username,
    context,
    appeal,
    contextLine: validation.target.context,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Appeal Submitted",
    description: `Your appeal #${appeal.id} was created for **${validation.target.actionType.toUpperCase()}**.`,
  });
  embed.addFields([
    { name: "Guild", value: guild.name, inline: true },
    { name: "Target", value: validation.target.context, inline: false },
    { name: "Appeal Reason", value: reason, inline: false },
    { name: "Evidence", value: evidence ?? "None provided", inline: false },
    {
      name: "Staff Review",
      value: createdReview
        ? `Created in ${createdReview.channel}`
        : "Queued (review channel could not be created automatically)",
      inline: false,
    },
  ]);
  await modalInteraction.editReply({ embeds: [embed.toJSON()] });

  if (!createdReview) {
    context.logger.Warn("Appeal review channel was not created", {
      extra: { appealId: appeal.id, guildId: guild.id },
    });
    return;
  }

  const approve = componentRouter.RegisterButton({
    handler: async (btn) => {
      await HandleAppealDecisionButton(btn, context, appeal.id, "approved");
    },
    expiresInMs: 1000 * 60 * 60 * 24 * 7,
  });
  const deny = componentRouter.RegisterButton({
    handler: async (btn) => {
      await HandleAppealDecisionButton(btn, context, appeal.id, "denied");
    },
    expiresInMs: 1000 * 60 * 60 * 24 * 7,
  });

  const actionRow = ComponentFactory.CreateActionRow({
    buttons: [
      { label: "Approve", style: ButtonStyle.Success },
      { label: "Deny", style: ButtonStyle.Danger },
    ],
    customIds: [approve.customId, deny.customId],
  });

  const reviewEmbed = BuildAppealReviewEmbed({
    appeal,
    guildName: guild.name,
    userTag: modalInteraction.user.tag,
    contextLine: validation.target.context,
  });

  const reviewMessage = await createdReview.channel.send({
    content: `<@${modalInteraction.user.id}>`,
    embeds: [reviewEmbed.toJSON()],
    components: [actionRow.toJSON()],
  });

  context.databases.moderationDb.UpdateAppealReviewMessage({
    id: appeal.id,
    review_channel_id: createdReview.channel.id,
    review_message_id: reviewMessage.id,
  });
}

function RegisterAppealSelectFlow(data: {
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
              entry.actionRef === parsed.actionRef
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
            new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput)
          );

          modalRouter.RegisterModal({
            customId: modalCustomId,
            ownerId: interaction.user.id,
            singleUse: true,
            expiresInMs: APPEAL_MODAL_TIMEOUT_MS,
            handler: async (modalInteraction) => {
              const reason = modalInteraction.fields.getTextInputValue("reason").trim();
              const evidenceRaw = modalInteraction.fields
                .getTextInputValue("evidence")
                .trim();
              const evidence = evidenceRaw.length > 0 ? evidenceRaw : null;

              await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

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

export async function BeginAppealSubmission(data: {
  interaction: AppealStartInteraction;
  context: CommandContext;
  guild: Guild;
  requestedAction?: AppealActionType | null;
}): Promise<void> {
  const { interaction, context, guild, requestedAction } = data;
  const { interactionResponder } = context.responders;

  const appealManager = CreateAppealManager({
    guildId: guild.id,
    userId: interaction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const options = appealManager.ListAppealableActions(requestedAction ?? undefined);
  if (options.length === 0) {
    const detail = requestedAction
      ? `You do not have any ${requestedAction} records to appeal, or an open appeal already exists for them.`
      : "You do not have any warnings, mutes, bans, or kicks to appeal, or all eligible actions already have open appeals.";
    const embed = EmbedFactory.CreateWarning({
      title: "Nothing To Appeal",
      description: detail,
    });
    await interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
      components: [],
    });
    return;
  }

  const flowInteractionId = String(interaction.id);
  const builtOptions = await BuildActionSelectOptions(
    options,
    guild,
    interaction.client
  );

  RegisterAppealSelectFlow({
    interaction,
    context,
    guild,
    flowInteractionId,
    options,
  });
  const menu = ComponentFactory.CreateSelectMenu({
    customId: `appeal-select:${flowInteractionId}`,
    placeholder: "Select the action you want to appeal...",
    minValues: 1,
    maxValues: 1,
    options: builtOptions,
  });

  const embed = EmbedFactory.Create({
    title: "Select Action To Appeal",
    description: `Found **${options.length}** moderation action(s). Choose one below, then fill out your reason and evidence in the next step.`,
  });
  await interactionResponder.Edit(interaction, {
    embeds: [embed.toJSON()],
    components: [ToActionRowData(ComponentFactory.CreateSelectMenuRow(menu))],
  });
}

export async function HandleSubmit(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Appeals can only be submitted inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const requestedAction = interaction.options.getString("action") as
    | AppealActionType
    | null;

  const deferred = await interactionResponder.Defer(interaction, true);
  if (!deferred.success) {
    return;
  }

  await BeginAppealSubmission({
    interaction,
    context,
    guild: interaction.guild,
    requestedAction,
  });
}

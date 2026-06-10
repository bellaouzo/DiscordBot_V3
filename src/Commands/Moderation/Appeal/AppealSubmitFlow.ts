import {
  ChatInputCommandInteraction,
  Guild,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands";
import { AppealActionType } from "@database";
import {
  ComponentFactory,
  CreateAppealManager,
  EmbedFactory,
  ToActionRowData,
} from "@utilities";
import { BuildActionSelectOptions } from "@commands/Moderation/Appeal/AppealShared";
import {
  AppealStartInteraction,
  RegisterAppealSelectFlow,
} from "@commands/Moderation/Appeal/AppealSubmitSelectFlow";

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

  const options = appealManager.ListAppealableActions(
    requestedAction ?? undefined,
  );
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
    interaction.client,
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
  context: CommandContext,
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

  const requestedAction = interaction.options.getString(
    "action",
  ) as AppealActionType | null;

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

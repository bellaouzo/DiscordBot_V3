import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import {
  CreateAppealManager,
  CreateWarnManager,
  EmbedFactory,
} from "@utilities";

async function ExecuteModHistory(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const guild = interaction.guild!;
  const userId = interaction.user.id;

  const warnManager = CreateWarnManager({
    guildId: guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const modDb = context.databases.moderationDb;
  const appealManager = CreateAppealManager({
    guildId: guild.id,
    userId,
    moderationDb: modDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const warnings = warnManager.GetUserWarnings(userId);
  const mutes = modDb.ListUserTempActions({
    guild_id: guild.id,
    user_id: userId,
    action: "mute",
    limit: 10,
  });
  const kicks = modDb.ListModerationEvents({
    guild_id: guild.id,
    user_id: userId,
    action: "kick",
    limit: 10,
  });
  const bans = modDb.ListModerationEvents({
    guild_id: guild.id,
    user_id: userId,
    action: "ban",
    limit: 10,
  });
  const openAppeals = appealManager.ListAppeals("open");

  const embed = EmbedFactory.Create({
    title: "Your Moderation History",
    description: `Summary of moderation actions against you in **${guild.name}**.`,
  });

  embed.addFields({
    name: "Warnings",
    value:
      warnings.length === 0
        ? "None"
        : `**${warnings.length}** total\nLatest: ${new Date(
            warnings[warnings.length - 1].created_at,
          ).toLocaleDateString()}`,
    inline: true,
  });

  embed.addFields({
    name: "Mutes",
    value:
      mutes.length === 0
        ? "None"
        : `**${mutes.length}** recorded\nLatest: ${new Date(
            mutes[0].created_at,
          ).toLocaleDateString()}`,
    inline: true,
  });

  embed.addFields({
    name: "Kicks",
    value:
      kicks.length === 0
        ? "None"
        : `**${kicks.length}** recorded\nLatest: ${new Date(
            kicks[0].created_at,
          ).toLocaleDateString()}`,
    inline: true,
  });

  embed.addFields({
    name: "Bans",
    value:
      bans.length === 0
        ? "None"
        : `**${bans.length}** recorded\nLatest: ${new Date(
            bans[0].created_at,
          ).toLocaleDateString()}`,
    inline: true,
  });

  embed.addFields({
    name: "Open Appeals",
    value:
      openAppeals.length === 0
        ? "None"
        : `**${openAppeals.length}** pending\nUse \`/appeal my\` for details`,
    inline: true,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

export const ModHistoryCommand = CreateCommand({
  name: "modhistory",
  description: "View your moderation history in this server",
  group: "utility",
  config: Config.utility(3),
  execute: ExecuteModHistory,
});

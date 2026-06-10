import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { RequireGuild, EmbedFactory } from "@utilities";
import { LevelManager } from "@systems/Leveling";

function BuildProgressBar(percent: number, length = 10): string {
  const filled = Math.floor((percent / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function GetLevelEmoji(level: number): string {
  if (level >= 50) return "🏆";
  if (level >= 30) return "💎";
  if (level >= 20) return "🥇";
  if (level >= 10) return "🥈";
  if (level >= 5) return "🥉";
  return "⭐";
}

async function ExecuteRank(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const guildId = RequireGuild(interaction).id;
  const userXp = context.databases.userDb.GetUserXp(targetUser.id, guildId);

  if (!userXp) {
    const embed = EmbedFactory.CreateWarning({
      title: "No XP Record",
      description: `${targetUser.displayName} has not earned any XP in this server yet.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const levelManager = new LevelManager(guildId, context.databases.userDb);

  const userLevel = levelManager.GetUserLevel(targetUser.id);
  const rank = levelManager.GetUserRank(targetUser.id);
  const progressBar = BuildProgressBar(userLevel.progressPercent, 12);
  const levelEmoji = GetLevelEmoji(userLevel.level);

  const embed = EmbedFactory.Create({
    title: `${levelEmoji} ${targetUser.displayName}'s Level`,
    thumbnail: targetUser.displayAvatarURL({ size: 128 }),
    description: [
      `**Level ${userLevel.level}**`,
      ``,
      `${progressBar} ${userLevel.progressPercent}%`,
      `\`${userLevel.currentXp.toLocaleString()} / ${userLevel.xpToNextLevel.toLocaleString()} XP\``,
      ``,
      `📊 **Server Rank:** #${rank}`,
      `✨ **Total XP Earned:** ${userLevel.totalXpEarned.toLocaleString()}`,
    ].join("\n"),
    footer: "Earn XP through economy activities!",
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
  });
}

export const RankCommand = CreateCommand({
  name: "rank",
  description: "View your or another user's level and XP progress",
  group: "fun",
  configure: (builder) => {
    builder.addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check rank for (optional)")
        .setRequired(false),
    );
  },
  config: Config.utility(3),
  execute: ExecuteRank,
});

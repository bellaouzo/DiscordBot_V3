import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
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
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guildId) {
    const embed = EmbedFactory.CreateError({
      title: "Server Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const levelManager = new LevelManager(interaction.guildId, context.databases.userDb);
  
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
    ephemeral: false,
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
        .setRequired(false)
    );
  },
  config: Config.utility(3),
  execute: ExecuteRank,
});

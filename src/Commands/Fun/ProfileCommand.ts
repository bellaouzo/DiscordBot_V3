import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory, CreateWarnManager, CreateNoteManager } from "@utilities";
import { LevelManager } from "@systems/Leveling";
import { EconomyManager } from "@systems/Economy/EconomyManager";

function FormatDate(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

function GetLevelEmoji(level: number): string {
  if (level >= 50) return "🏆";
  if (level >= 30) return "💎";
  if (level >= 20) return "🥇";
  if (level >= 10) return "🥈";
  if (level >= 5) return "🥉";
  return "⭐";
}

function FormatBadges(flags: readonly string[]): string {
  if (!flags || flags.length === 0) {
    return "None";
  }

  const badgeMap: Record<string, string> = {
    ActiveDeveloper: "🟢 Active Developer",
    BotHTTPInteractions: "🤖 Bot Interactions",
    BugHunterLevel1: "🐛 Bug Hunter",
    BugHunterLevel2: "🐛 Bug Hunter Level 2",
    CertifiedModerator: "✅ Certified Moderator",
    HypeSquadOnlineHouse1: "🏠 HypeSquad Bravery",
    HypeSquadOnlineHouse2: "🏠 HypeSquad Brilliance",
    HypeSquadOnlineHouse3: "🏠 HypeSquad Balance",
    HypeSquadEvents: "🎉 HypeSquad Events",
    Partner: "👑 Partner",
    PremiumEarlySupporter: "💎 Early Supporter",
    Staff: "👔 Discord Staff",
    VerifiedBot: "✅ Verified Bot",
    VerifiedDeveloper: "👨‍💻 Early Verified Bot Developer",
  };

  return flags.map((flag) => badgeMap[flag] || flag).join(", ");
}

async function ExecuteProfile(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const targetMember = await interaction.guild.members
    .fetch({ user: targetUser.id, withPresences: true })
    .catch(() => null);

  const levelManager = new LevelManager(
    interaction.guild.id,
    context.databases.userDb
  );
  const economyManager = new EconomyManager(
    interaction.guild.id,
    context.databases.userDb
  );
  const warnManager = CreateWarnManager({
    guildId: interaction.guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });
  const noteManager = CreateNoteManager({
    guildId: interaction.guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const userLevel = levelManager.GetUserLevel(targetUser.id);
  const rank = levelManager.GetUserRank(targetUser.id);
  const balance = economyManager.GetBalance(targetUser.id);
  const warnings = warnManager.GetUserWarnings(targetUser.id);
  const notes = noteManager.GetUserNotes(targetUser.id);

  const levelEmoji = GetLevelEmoji(userLevel.level);
  const joinDate = targetMember?.joinedTimestamp
    ? FormatDate(targetMember.joinedTimestamp)
    : "Unknown";
  const accountAge = FormatDate(targetUser.createdTimestamp);
  const roleCount = targetMember?.roles.cache.size
    ? targetMember.roles.cache.size - 1
    : 0; // -1 to exclude @everyone

  const embed = EmbedFactory.Create({
    title: `${levelEmoji} ${targetUser.displayName}'s Profile`,
    thumbnail: targetUser.displayAvatarURL({ size: 256 }),
    description:
      targetMember?.displayName !== targetUser.username
        ? `**${targetUser.username}**`
        : undefined,
  });

  embed.addFields(
    {
      name: "📊 Level & XP",
      value: [
        `**Level:** ${userLevel.level}`,
        `**XP:** ${userLevel.currentXp.toLocaleString()} / ${userLevel.xpToNextLevel.toLocaleString()}`,
        `**Rank:** #${rank}`,
        `**Total XP:** ${userLevel.totalXpEarned.toLocaleString()}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: "💰 Economy",
      value: [
        `**Balance:** ${balance.toLocaleString()} coins`,
        `**Inventory:** Check with \`/economy inventory\``,
      ].join("\n"),
      inline: true,
    },
    {
      name: "🛡️ Moderation",
      value: [
        `**Warnings:** ${warnings.length}`,
        `**Notes:** ${notes.length}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: "📅 Dates",
      value: [
        `**Joined:** ${joinDate}`,
        `**Account Created:** ${accountAge}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: "👤 User Info",
      value: [
        `**ID:** \`${targetUser.id}\``,
        `**Roles:** ${roleCount}`,
        `**Badges:** ${FormatBadges(targetUser.flags?.toArray() || [])}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: "🎭 Status",
      value: [
        `**Status:** ${targetMember?.presence?.status || "offline"}`,
        targetMember?.presence?.activities?.[0]
          ? `**Activity:** ${targetMember.presence.activities[0].name}`
          : "**Activity:** None",
      ].join("\n"),
      inline: true,
    }
  );

  embed.setFooter({
    text: `Requested by ${interaction.user.displayName}`,
    iconURL: interaction.user.displayAvatarURL({ size: 32 }),
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

export const ProfileCommand = CreateCommand({
  name: "profile",
  description: "View a user's profile with stats and information",
  group: "fun",
  configure: (builder) => {
    builder.addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to view profile for (optional)")
        .setRequired(false)
    );
  },
  config: Config.utility(3),
  execute: ExecuteProfile,
});

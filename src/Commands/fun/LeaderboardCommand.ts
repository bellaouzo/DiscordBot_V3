import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { LevelManager } from "@systems/leveling";
import { EconomyManager } from "@systems/economy/EconomyManager";
import { PaginationPage } from "@shared/Paginator";

type LeaderboardType = "xp" | "coins";

const ITEMS_PER_PAGE = 10;

function GetMedalEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `**${rank}.**`;
  }
}

async function ExecuteLeaderboard(
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

  const type = (interaction.options.getString("type") ?? "xp") as LeaderboardType;

  if (type === "xp") {
    await ShowXpLeaderboard(interaction, context);
  } else {
    await ShowCoinsLeaderboard(interaction, context);
  }
}

async function ShowXpLeaderboard(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { paginatedResponder } = context.responders;
  const levelManager = new LevelManager(interaction.guildId!, context.databases.userDb);

  const entries = levelManager.GetLeaderboard(50);

  if (entries.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No XP Data",
      description: "No one has earned any XP yet! Use economy commands to start earning.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const pages: PaginationPage[] = [];
  const guild = interaction.guild!;

  for (let i = 0; i < entries.length; i += ITEMS_PER_PAGE) {
    const pageEntries = entries.slice(i, i + ITEMS_PER_PAGE);
    const lines: string[] = [];

    for (const entry of pageEntries) {
      const medal = GetMedalEmoji(entry.rank);
      let displayName = `<@${entry.userId}>`;
      
      try {
        const member = await guild.members.fetch(entry.userId).catch(() => null);
        if (member) {
          displayName = member.displayName;
        }
      } catch {
        // Use mention fallback
      }

      lines.push(
        `${medal} ${displayName} — **Level ${entry.level}** (${entry.totalXpEarned.toLocaleString()} total XP)`
      );
    }

    const embed = EmbedFactory.Create({
      title: "🏆 XP Leaderboard",
      description: lines.join("\n"),
      footer: `Page ${Math.floor(i / ITEMS_PER_PAGE) + 1} of ${Math.ceil(entries.length / ITEMS_PER_PAGE)} • ${entries.length} ranked users`,
    });

    pages.push({ embeds: [embed.toJSON()] });
  }

  await paginatedResponder.Send({
    interaction,
    pages,
    ephemeral: false,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 5,
  });
}

async function ShowCoinsLeaderboard(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { paginatedResponder } = context.responders;
  const economyManager = new EconomyManager(interaction.guildId!, context.databases.userDb);

  const entries = economyManager.GetTopBalances(50);

  if (entries.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Economy Data",
      description: "No one has any coins yet! Use `/economy daily` to get started.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const pages: PaginationPage[] = [];
  const guild = interaction.guild!;

  for (let i = 0; i < entries.length; i += ITEMS_PER_PAGE) {
    const pageEntries = entries.slice(i, i + ITEMS_PER_PAGE);
    const lines: string[] = [];

    for (let j = 0; j < pageEntries.length; j++) {
      const entry = pageEntries[j];
      const rank = i + j + 1;
      const medal = GetMedalEmoji(rank);
      let displayName = `<@${entry.userId}>`;

      try {
        const member = await guild.members.fetch(entry.userId).catch(() => null);
        if (member) {
          displayName = member.displayName;
        }
      } catch {
        // Use mention fallback
      }

      lines.push(`${medal} ${displayName} — **${entry.balance.toLocaleString()}** 🪙`);
    }

    const embed = EmbedFactory.Create({
      title: "💰 Coins Leaderboard",
      description: lines.join("\n"),
      footer: `Page ${Math.floor(i / ITEMS_PER_PAGE) + 1} of ${Math.ceil(entries.length / ITEMS_PER_PAGE)} • ${entries.length} ranked users`,
    });

    pages.push({ embeds: [embed.toJSON()] });
  }

  await paginatedResponder.Send({
    interaction,
    pages,
    ephemeral: false,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 5,
  });
}

export const LeaderboardCommand = CreateCommand({
  name: "leaderboard",
  description: "View the server leaderboard for XP or coins",
  group: "fun",
  configure: (builder) => {
    builder.addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Leaderboard type")
        .setRequired(false)
        .addChoices(
          { name: "XP Levels", value: "xp" },
          { name: "Coins", value: "coins" }
        )
    );
  },
  config: Config.utility(5),
  execute: ExecuteLeaderboard,
});

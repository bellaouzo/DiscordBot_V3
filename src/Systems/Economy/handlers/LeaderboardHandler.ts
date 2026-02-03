import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import { BuildLeaderboardEmbed } from "@systems/Economy/utils/Embeds";
import { EmbedFactory } from "@utilities";

export async function HandleLeaderboard(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const manager = new EconomyManager(
    interaction.guildId!,
    context.databases.userDb
  );

  try {
    const top = manager.GetTopBalances(10);

    if (top.length === 0) {
      const emptyEmbed = BuildLeaderboardEmbed({ entries: [] });
      await interactionResponder.Reply(interaction, {
        embeds: [emptyEmbed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const resolvedNames = await Promise.all(
      top.map(async (entry) => {
        if (!guild) {
          return undefined;
        }
        const member = await guild.members
          .fetch(entry.userId)
          .catch(() => null);
        return member?.displayName ?? member?.user?.username ?? undefined;
      })
    );

    const embed = BuildLeaderboardEmbed({
      entries: top.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        balance: entry.balance,
        name: resolvedNames[index],
      })),
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    const embed = EmbedFactory.CreateError({
      title: "Leaderboard Error",
      description: "Failed to load the leaderboard. Please try again.",
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    context.logger.Error("Failed to build leaderboard", { error });
  } finally {
    void 0;
  }
}

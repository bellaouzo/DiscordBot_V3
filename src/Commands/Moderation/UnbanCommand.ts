import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";

async function ExecuteUnban(
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

  const userId = interaction.options.getString("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";

  const bannedUser = await interaction.guild.bans
    .fetch(userId)
    .catch(() => null);

  if (!bannedUser) {
    const embed = EmbedFactory.CreateError({
      title: "User Not Banned",
      description: "That user is not currently banned.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const targetTag = bannedUser.user.tag;

  await interactionResponder.WithAction({
    interaction,
    message: {
      embeds: [
        EmbedFactory.Create({
          title: "Processing Unban",
          description: `Unbanning **${targetTag}**...`,
        }).toJSON(),
      ],
    },
    followUp: () => {
      const embed = EmbedFactory.CreateSuccess({
        title: "User Unbanned",
        description: `Successfully unbanned **${targetTag}**`,
      });

      if (reason !== "No reason provided") {
        embed.addFields([{ name: "Reason", value: reason, inline: false }]);
      }

      return { embeds: [embed.toJSON()] };
    },
    action: async () => {
      await interaction.guild?.members.unban(bannedUser.user.id, reason);
    },
  });
}

export const UnbanCommand = CreateCommand({
  name: "unban",
  description: "Unban a user from the server",
  group: "moderation",
  config: Config.mod(5).build(),
  execute: ExecuteUnban,
  configure: (builder) => {
    builder
      .addStringOption((option) =>
        option
          .setName("user")
          .setDescription("The user ID to unban")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for unbanning")
          .setRequired(false)
      );
  },
});

import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import { LoggingMiddleware } from "../Middleware/LoggingMiddleware";
import { PermissionMiddleware } from "../Middleware/PermissionMiddleware";
import { ErrorMiddleware } from "../Middleware/ErrorMiddleware";
import { Config } from "../Middleware/CommandConfig";
import { EmbedFactory } from "../../Utilities";

async function ExecuteUnban(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  const userId = interaction.options.getString("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";

  if (!interaction.guild) {
    throw new Error("This command can only be used in a server.");
  }

  const bannedUser = await interaction.guild.bans
    .fetch(userId)
    .catch(() => null);

  if (!bannedUser) {
    throw new Error("That user is not currently banned.");
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
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.moderation(5),
  execute: ExecuteUnban,
});

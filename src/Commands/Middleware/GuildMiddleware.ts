import { CommandMiddleware } from "./index";
import { EmbedFactory } from "@utilities";

export const GuildMiddleware: CommandMiddleware = {
  name: "guild-only",
  execute: async (context, next) => {
    if (context.interaction.guild) {
      await next();
      return;
    }

    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(context.interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  },
};

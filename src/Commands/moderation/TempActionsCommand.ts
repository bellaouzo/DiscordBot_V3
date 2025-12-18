import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";

async function ExecuteTempActions(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const db = context.databases.moderationDb;
  const pending = db.ListPendingTempActions(interaction.guild.id);

  if (pending.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Pending Temp Actions",
      description: "There are no active temporary bans or mutes.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const rows = pending
    .slice(0, 15)
    .map((entry) => {
      const expires = `<t:${Math.floor(entry.expires_at / 1000)}:R>`;
      const reason = entry.reason ?? "No reason provided";
      return `• **${entry.action.toUpperCase()}** — <@${entry.user_id}> expires ${expires}\n  Mod: <@${entry.moderator_id}> — ${reason}`;
    })
    .join("\n\n");

  const embed = EmbedFactory.Create({
    title: "⏳ Pending Temporary Actions",
    description: rows,
    footer:
      pending.length > 15
        ? `Showing 15 of ${pending.length} entries`
        : undefined,
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

export const TempActionsCommand = CreateCommand({
  name: "tempactions",
  description: "View active temporary bans and mutes",
  group: "moderation",
  config: Config.mod(3).build(),
  execute: ExecuteTempActions,
  configure: (builder) => {
    builder.setDescription("View active temporary bans and mutes");
  },
});

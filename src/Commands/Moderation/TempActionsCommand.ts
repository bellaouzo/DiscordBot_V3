import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { PaginationPage } from "@shared/Paginator";
import { TempAction } from "@database";

const TEMP_ACTIONS_PAGE_SIZE = 6;

function BuildTempActionPages(entries: TempAction[]): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < entries.length; index += TEMP_ACTIONS_PAGE_SIZE) {
    const slice = entries.slice(index, index + TEMP_ACTIONS_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: "⏳ Pending Temporary Actions",
      description: `Showing ${start} - ${end} of ${entries.length}`,
    });

    embed.addFields(
      slice.map((entry, sliceIndex) => {
        const expires = `<t:${Math.floor(entry.expires_at / 1000)}:R>`;
        const reason = entry.reason ?? "No reason provided";
        return {
          name: `#${start + sliceIndex} — ${entry.action.toUpperCase()}`,
          value: `<@${entry.user_id}> expires ${expires}\nMod: <@${entry.moderator_id}>\n${reason}`,
          inline: false,
        };
      }),
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

async function ExecuteTempActions(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, paginatedResponder } = context.responders;
  const db = context.databases.moderationDb;
  const pending = db.ListPendingTempActions(interaction.guild!.id);

  if (pending.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Pending Temp Actions",
      description: "There are no active temporary bans or mutes.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pages = BuildTempActionPages(pending);

  await paginatedResponder.Send({
    interaction,
    pages,
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
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

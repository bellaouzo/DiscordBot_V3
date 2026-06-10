import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import {
  RequireGuild,
  CreateWarnManager,
  EmbedFactory,
  ToEmbedData,
} from "@utilities";
import type { PaginationPage } from "@shared/Paginator";

const WARN_LIST_PAGE_SIZE = 6;

async function ExecuteWarnings(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, paginatedResponder } = context.responders;
  const guild = RequireGuild(interaction);

  const warnManager = CreateWarnManager({
    guildId: guild.id,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const warnings = warnManager.GetUserWarnings(interaction.user.id);

  if (warnings.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Warnings",
      description: "You have no warnings in this server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [ToEmbedData(embed)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pages = BuildWarningPages(warnings, interaction.user.tag);

  await paginatedResponder.Send({
    interaction,
    pages,
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

function BuildWarningPages(
  warnings: ReturnType<ReturnType<typeof CreateWarnManager>["GetUserWarnings"]>,
  userTag: string,
): PaginationPage[] {
  const pages: PaginationPage[] = [];

  for (let index = 0; index < warnings.length; index += WARN_LIST_PAGE_SIZE) {
    const slice = warnings.slice(index, index + WARN_LIST_PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: `Your Warnings — ${userTag}`,
      description: `Showing warnings ${start} - ${end} of ${warnings.length}`,
    });

    embed.addFields(
      slice.map((warning, sliceIndex) => {
        const date = new Date(warning.created_at).toLocaleDateString();
        const reason = warning.reason ?? "No reason provided";
        const warningNumber = start + sliceIndex;
        return {
          name: `#${warningNumber} — ${date}`,
          value: `Mod: <@${warning.moderator_id}>\nReason: ${reason}`,
          inline: false,
        };
      }),
    );

    pages.push({ embeds: [ToEmbedData(embed)] });
  }

  return pages;
}

export const WarningsCommand = CreateCommand({
  name: "warnings",
  description: "View your own warnings in this server",
  group: "utility",
  config: Config.utility(3),
  execute: ExecuteWarnings,
});

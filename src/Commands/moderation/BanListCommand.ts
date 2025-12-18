import { ChatInputCommandInteraction, GuildBan } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { PaginationPage } from "@shared/Paginator";

const PAGE_SIZE = 10;

async function ExecuteBanList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(false) ?? "list";

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

  if (subcommand === "check") {
    await ExecuteBanCheck(interaction, context);
    return;
  }

  await ExecuteBanListPages(interaction, context);
}

async function ExecuteBanListPages(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { paginatedResponder, interactionResponder } = context.responders;

  try {
    const bans = await interaction.guild!.bans.fetch();
    const banEntries = Array.from(bans.values());

    if (banEntries.length === 0) {
      const embed = EmbedFactory.CreateWarning({
        title: "Ban List Empty",
        description: "There are no banned users for this server.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const pages = BuildBanPages(banEntries);

    await paginatedResponder.Send({
      interaction,
      pages,
      ephemeral: true,
      ownerId: interaction.user.id,
      timeoutMs: 1000 * 60 * 3,
      idleTimeoutMs: 1000 * 60 * 2,
    });
  } catch (error) {
    context.logger.Error("Failed to fetch ban list", { error });
    throw error;
  }
}

async function ExecuteBanCheck(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const userOption = interaction.options.getUser("user", true);
  const userId = userOption.id;

  try {
    const bans = await interaction.guild!.bans.fetch();
    const ban = bans.get(userId);

    if (!ban) {
      const embed = EmbedFactory.CreateWarning({
        title: "User Not Banned",
        description: `User \`${userId}\` is **not** banned.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const embed = EmbedFactory.Create({
      title: "🔎 Ban Check",
      description: `User **${ban.user.tag}** is currently banned.`,
    });

    embed.addFields([
      { name: "User ID", value: ban.user.id, inline: true },
      {
        name: "Reason",
        value: ban.reason ?? "No reason provided",
        inline: false,
      },
    ]);

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to check ban status", { error });
    throw error;
  }
}

function BuildBanPages(bans: GuildBan[]): PaginationPage[] {
  const sortedBans = [...bans].sort((a, b) =>
    a.user.username.localeCompare(b.user.username)
  );

  const chunks: PaginationPage[] = [];

  for (let index = 0; index < sortedBans.length; index += PAGE_SIZE) {
    const slice = sortedBans.slice(index, index + PAGE_SIZE);
    const start = index + 1;
    const end = index + slice.length;

    const embed = EmbedFactory.Create({
      title: "🔨 Server Ban List",
      description: `Showing bans ${start} - ${end} of ${sortedBans.length}`,
    });

    embed.addFields(
      slice.map((ban, sliceIndex) => ({
        name: `${start + sliceIndex}. ${ban.user.tag}`,
        value: `ID: ${ban.user.id}\nReason: ${ban.reason ?? "No reason provided"}`,
        inline: false,
      }))
    );

    chunks.push({ embeds: [embed.toJSON()] });
  }

  return chunks;
}

export const BanListCommand = CreateCommand({
  name: "banlist",
  description: "View the server ban list or check a user's ban status",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteBanList,
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("View the server ban list with pagination")
      )
      .addSubcommand((sub) =>
        sub
          .setName("check")
          .setDescription("Check if a user is banned")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to check")
              .setRequired(true)
          )
      );
  },
});

import type {
  ChatInputCommandInteraction,
  NewsChannel,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import type { CommandContext } from "@commands";
import {
  RequireGuild,
  EmbedFactory,
  IsModerator,
  ResolveInteractionMember,
  ToActionRowData,
  ToEmbedData,
} from "@utilities";
import type { GiveawayManager } from "@systems/Giveaway/GiveawayManager";

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 10080;
export type GuildTextChannel = TextChannel | NewsChannel | ThreadChannel;

export async function RequireModerator(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<boolean> {
  const settings = context.databases.serverDb.GetGuildSettings(
    RequireGuild(interaction).id,
  );
  const member = await ResolveInteractionMember(interaction);
  if (IsModerator(member, settings)) {
    return true;
  }

  const embed = EmbedFactory.CreateError({
    title: "Permission Denied",
    description: "You must be a moderator to use this subcommand.",
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [ToEmbedData(embed)],
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

export async function CanManageGiveaway(
  interaction: ChatInputCommandInteraction,
  hostId: string,
  context: CommandContext,
): Promise<boolean> {
  if (interaction.user.id === hostId) {
    return true;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    RequireGuild(interaction).id,
  );
  const member = await ResolveInteractionMember(interaction);
  return IsModerator(member, settings);
}

export async function UpdateEntryCount(
  channel: GuildTextChannel,
  messageId: string,
  manager: GiveawayManager,
  giveaway: {
    prize: string;
    ends_at: number;
    winner_count: number;
    host_id: string;
  },
  entryCount: number,
  userHasEntered: boolean,
): Promise<void> {
  try {
    const message = await channel.messages.fetch(messageId);
    const { embed } = manager.CreateGiveawayMessage({
      prize: giveaway.prize,
      endsAt: giveaway.ends_at,
      winnerCount: giveaway.winner_count,
      hostId: giveaway.host_id,
      entryCount,
    });

    const firstRow = message.components[0];
    const firstComponent =
      firstRow && "components" in firstRow ? firstRow.components[0] : undefined;
    const existingCustomId =
      firstComponent && "customId" in firstComponent
        ? firstComponent.customId
        : undefined;

    if (existingCustomId) {
      const button = new ButtonBuilder()
        .setCustomId(existingCustomId)
        .setLabel(userHasEntered ? "🚪 Leave Giveaway" : "🎉 Enter Giveaway")
        .setStyle(userHasEntered ? ButtonStyle.Secondary : ButtonStyle.Primary);
      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        button,
      );

      await message.edit({
        embeds: [ToEmbedData(embed)],
        components: [ToActionRowData(newRow)],
      });
    }
  } catch {
    void 0;
  }
}

import { ChatInputCommandInteraction, TextChannel, Guild } from "discord.js";
import { GuildMemberOrAPI } from "@commands/utility/ticket/types/TicketTypes";
import { TicketDatabase, Ticket } from "@database";
import { CreateTicketManager, CreateGuildResourceLocator } from "@utilities";
import { Logger } from "@shared/Logger";
import { InteractionResponder } from "@responders";
import { EmbedFactory } from "@utilities";

export function HasStaffPermissions(member: GuildMemberOrAPI): boolean {
  if (!member || typeof member.permissions === "string") {
    return false;
  }
  return (
    member.permissions.has("ManageGuild") ||
    member.permissions.has("Administrator")
  );
}

export function ValidateTicketChannel(
  channel: ChatInputCommandInteraction["channel"]
): boolean {
  return !!(channel && channel.isTextBased());
}

export function CreateTicketServices(logger: Logger, guild: Guild, ticketDb: TicketDatabase) {
  const guildResourceLocator = CreateGuildResourceLocator({
    guild,
    logger,
  });
  const ticketManager = CreateTicketManager({
    guild,
    logger,
    ticketDb,
    guildResourceLocator,
  });
  return { ticketDb, ticketManager, guildResourceLocator };
}

export async function ValidateGuildOrReply(
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder
): Promise<boolean> {
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export async function ValidateTicketChannelOrReply(
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder
): Promise<boolean> {
  if (!interaction.guild || !ValidateTicketChannel(interaction.channel)) {
    const embed = EmbedFactory.CreateError({
      title: "Ticket Channel Only",
      description: "This command can only be used in a ticket channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export async function GetTicketOrReply(
  ticketDb: TicketDatabase,
  channel: TextChannel,
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder
): Promise<Ticket | null> {
  const ticket = ticketDb.GetTicketByChannel(channel.id);
  if (!ticket) {
    const embed = EmbedFactory.CreateError({
      title: "Not a Ticket",
      description: "This channel is not a ticket.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
  return ticket;
}



import {
  ChatInputCommandInteraction,
  TextChannel,
  Guild,
} from "discord.js";
import { GuildMemberOrAPI } from "../types/TicketTypes";
import { TicketDatabase, Ticket } from "../../../../Database";
import { CreateTicketManager, CreateGuildResourceLocator } from "../../../../Utilities";
import { Logger } from "../../../../Shared/Logger";
import { InteractionResponder } from "../../../../Responders";

export function HasStaffPermissions(
  member: GuildMemberOrAPI
): boolean {
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

export function CreateTicketServices(logger: Logger, guild: Guild) {
  const ticketDb = new TicketDatabase(logger);
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
    await interactionResponder.Reply(interaction, {
      content: "This command can only be used in a server.",
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
    await interactionResponder.Reply(interaction, {
      content: "This command can only be used in a ticket channel.",
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
    await interactionResponder.Reply(interaction, {
      content: "This channel is not a ticket.",
      ephemeral: true,
    });
  }
  return ticket;
}

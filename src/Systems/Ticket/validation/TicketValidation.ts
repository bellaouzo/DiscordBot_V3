import {
  ChatInputCommandInteraction,
  TextChannel,
  Guild,
  GuildMember,
  MessageFlags,
} from "discord.js";
import { TicketDatabase, Ticket } from "@database";
import { ServerDatabase } from "@database/ServerDatabase";
import {
  CreateTicketManager,
  CreateGuildResourceLocator,
  IsTicketStaff,
} from "@utilities";
import { Logger } from "@shared/Logger";
import { InteractionResponder } from "@responders";
import { EmbedFactory } from "@utilities";
import { CreateTicketPresentation } from "@systems/Ticket/TicketPresentation";
import { CreateTicketLogService } from "@systems/Ticket/services/TicketLogService";

export function HasStaffPermissions(
  member: GuildMember | null,
  settings?: {
    adminRoleIds?: string[];
    modRoleIds?: string[];
  } | null,
): boolean {
  return IsTicketStaff(member, settings);
}

export function CanUserCloseTicket(
  ticket: Ticket,
  userId: string,
  member: GuildMember | null,
  settings?: {
    adminRoleIds?: string[];
    modRoleIds?: string[];
  } | null,
): boolean {
  if (ticket.user_id === userId) {
    return true;
  }

  return HasStaffPermissions(member, settings);
}

export function CanUserAddParticipants(
  ticket: Ticket,
  userId: string,
  member: GuildMember | null,
  settings?: {
    adminRoleIds?: string[];
    modRoleIds?: string[];
  } | null,
): boolean {
  if (!member) {
    return false;
  }

  if (ticket.user_id === userId) {
    return true;
  }

  return HasStaffPermissions(member, settings);
}

export function CanUserRemoveParticipants(
  ticket: Ticket,
  userId: string,
  member: GuildMember | null,
  settings?: {
    adminRoleIds?: string[];
    modRoleIds?: string[];
  } | null,
): boolean {
  if (!member) {
    return false;
  }

  if (ticket.user_id === userId) {
    return true;
  }

  return HasStaffPermissions(member, settings);
}

export function ValidateTicketChannel(
  channel: ChatInputCommandInteraction["channel"],
): boolean {
  return !!(channel && channel.isTextBased());
}

export function CreateTicketServices(
  logger: Logger,
  guild: Guild,
  ticketDb: TicketDatabase,
  serverDb: ServerDatabase,
  options?: { ticketCategoryId?: string | null },
) {
  const settings = serverDb.GetGuildSettings(guild.id);
  const staffRoleIds = [
    ...(settings?.admin_role_ids ?? []),
    ...(settings?.mod_role_ids ?? []),
  ];
  const guildResourceLocator = CreateGuildResourceLocator({
    guild,
    logger,
  });
  const ticketCategoryId =
    options?.ticketCategoryId ?? settings?.ticket_category_id ?? null;
  const ticketLogChannelId = settings?.ticket_log_channel_id ?? null;

  const ticketManager = CreateTicketManager({
    guild,
    logger,
    ticketDb,
    guildResourceLocator,
    ticketCategoryId,
    staffRoleIds,
  });
  const ticketPresentation = CreateTicketPresentation({
    guild,
    ticketDb,
    logger,
  });
  const ticketLogService = CreateTicketLogService({
    guild,
    logger,
    staffRoleIds,
    ticketLogChannelId,
  });

  return {
    ticketDb,
    ticketManager,
    ticketPresentation,
    ticketLogService,
    guildResourceLocator,
    settings,
    staffRoleIds,
  };
}

export async function ValidateGuildOrReply(
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder,
): Promise<boolean> {
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

export async function ValidateTicketChannelOrReply(
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder,
): Promise<boolean> {
  if (!interaction.guild || !ValidateTicketChannel(interaction.channel)) {
    const embed = EmbedFactory.CreateError({
      title: "Ticket Channel Only",
      description: "This command can only be used in a ticket channel.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

export async function GetTicketOrReply(
  ticketDb: TicketDatabase,
  channel: TextChannel,
  interaction: ChatInputCommandInteraction,
  interactionResponder: InteractionResponder,
): Promise<Ticket | null> {
  const ticket = ticketDb.GetTicketByChannel(channel.id);
  if (!ticket) {
    const embed = EmbedFactory.CreateError({
      title: "Not a Ticket",
      description: "This channel is not a ticket.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  }
  return ticket;
}

export function ParseTicketButtonCustomId(customId: string): {
  action: "claim" | "close" | "add" | "remove";
  ticketId: number;
} | null {
  const match = customId.match(/^ticket:(claim|close|add|remove):(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    action: match[1] as "claim" | "close" | "add" | "remove",
    ticketId: Number.parseInt(match[2], 10),
  };
}

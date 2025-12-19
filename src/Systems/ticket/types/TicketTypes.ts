import {
  GuildMember,
  APIInteractionGuildMember,
  APIEmbed,
  ActionRowData,
  ActionRowComponentData,
  TextChannel,
} from "discord.js";
import { TicketDatabase, Ticket } from "@database";
import { CreateTicketManager } from "@utilities/TicketManager";

export const BUTTON_EXPIRATION_MS = 1000 * 60 * 60 * 24;

export interface TicketServices {
  readonly ticketDb: TicketDatabase;
  readonly ticketManager: ReturnType<typeof CreateTicketManager>;
}

export interface TicketListPage {
  readonly content: string;
  readonly embeds: APIEmbed[];
  readonly components: ActionRowData<ActionRowComponentData>[];
}

export interface TicketInfo {
  readonly id: number;
  readonly category: string;
  readonly status: string;
  readonly created_at: number;
  readonly tags?: string[];
}

export interface CreateTicketOptions {
  readonly userId: string;
  readonly category: string;
}

export interface TicketChannelInfo {
  readonly ticket: Ticket;
  readonly channel: TextChannel;
}

export type GuildMemberOrAPI = GuildMember | APIInteractionGuildMember | null;



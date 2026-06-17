import type {
  Ticket,
  TicketCategoryConfig,
  TicketMessage,
  TicketParticipant,
  TicketReopenAudit,
} from "@database/Ticket/Types";
import { IsTicketStatus } from "@database/Ticket/Types";

export function MapTicket(row: Record<string, unknown>): Ticket {
  const status = row.status;
  if (!IsTicketStatus(status)) {
    throw new Error(`Invalid ticket status: ${status}`);
  }
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    guild_id: String(row.guild_id),
    channel_id: row.channel_id ? String(row.channel_id) : null,
    category: String(row.category),
    status,
    claimed_by: row.claimed_by ? String(row.claimed_by) : null,
    created_at: Number(row.created_at),
    closed_at: row.closed_at ? Number(row.closed_at) : null,
    close_reason: row.close_reason ? String(row.close_reason) : null,
  };
}

export function MapTicketMessage(row: Record<string, unknown>): TicketMessage {
  return {
    id: Number(row.id),
    ticket_id: Number(row.ticket_id),
    user_id: String(row.user_id),
    content: String(row.content),
    timestamp: Number(row.timestamp),
  };
}

export function MapTicketParticipant(
  row: Record<string, unknown>,
): TicketParticipant {
  return {
    id: Number(row.id),
    ticket_id: Number(row.ticket_id),
    user_id: String(row.user_id),
    added_by: String(row.added_by),
    added_at: Number(row.added_at),
    removed_by: row.removed_by ? String(row.removed_by) : undefined,
    removed_at: row.removed_at ? Number(row.removed_at) : undefined,
  };
}

export function MapTicketReopenAudit(
  row: Record<string, unknown>,
): TicketReopenAudit {
  return {
    id: Number(row.id),
    prior_ticket_id: Number(row.prior_ticket_id),
    new_ticket_id: Number(row.new_ticket_id),
    guild_id: String(row.guild_id),
    reopened_by: String(row.reopened_by),
    reason: row.reason ? String(row.reason) : null,
    prior_status: row.prior_status ? String(row.prior_status) : null,
    transcript_url: row.transcript_url ? String(row.transcript_url) : null,
    created_at: Number(row.created_at),
  };
}

export function MapTicketCategoryConfig(
  row: Record<string, unknown>,
): TicketCategoryConfig {
  return {
    id: Number(row.id),
    guild_id: String(row.guild_id),
    value: String(row.value),
    label: String(row.label),
    description: String(row.description),
    emoji: String(row.emoji),
    sort_order: Number(row.sort_order),
  };
}

export type TicketStatus = "open" | "claimed" | "closed";

export function IsTicketStatus(value: unknown): value is TicketStatus {
  return value === "open" || value === "claimed" || value === "closed";
}

export interface Ticket {
  id: number;
  user_id: string;
  guild_id: string;
  channel_id: string | null;
  category: string;
  status: TicketStatus;
  claimed_by: string | null;
  created_at: number;
  closed_at: number | null;
}

export interface TicketReopenAudit {
  id: number;
  prior_ticket_id: number;
  new_ticket_id: number;
  guild_id: string;
  reopened_by: string;
  reason: string | null;
  prior_status: string | null;
  transcript_url: string | null;
  created_at: number;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: string;
  content: string;
  timestamp: number;
}

export interface TicketParticipant {
  id: number;
  ticket_id: number;
  user_id: string;
  added_by: string;
  added_at: number;
  removed_by?: string;
  removed_at?: number;
}

export interface TicketTag {
  id: number;
  ticket_id: number;
  tag: string;
  created_at: number;
}

export interface TicketCategory {
  value: string;
  label: string;
  description: string;
  emoji: string;
}

export interface TicketCategoryConfig extends TicketCategory {
  id: number;
  guild_id: string;
  sort_order: number;
}

export const TICKET_CATEGORIES: TicketCategory[] = [
  {
    value: "general",
    label: "General Support",
    description: "General questions and support",
    emoji: "💬",
  },
  {
    value: "technical",
    label: "Technical Issue",
    description: "Technical problems or bugs",
    emoji: "🔧",
  },
  {
    value: "report",
    label: "Report",
    description: "Report users or issues",
    emoji: "🚨",
  },
  {
    value: "other",
    label: "Other",
    description: "Other inquiries",
    emoji: "📝",
  },
];

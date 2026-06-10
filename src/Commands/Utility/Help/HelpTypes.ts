import type {
  ActionRowComponentData,
  ActionRowData,
  APIEmbed,
} from "discord.js";

export interface CommandInfo {
  readonly name: string;
  readonly description: string;
  readonly group: string;
}

export interface CategoryView {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly commands: CommandInfo[];
  readonly pages: APIEmbed[];
}

export interface OverviewPayload {
  readonly content: string;
  readonly embeds: APIEmbed[];
  readonly components: ActionRowData<ActionRowComponentData>[];
}

export const CACHE_DURATION = 1000 * 60 * 5;
export const HELP_SESSION_TIMEOUT_MS = 1000 * 60 * 15;
export const commandCache = new Map<
  string,
  { data: CommandInfo[]; timestamp: number }
>();

export function CreateOverviewCustomId(interactionId: string): string {
  return `help:${interactionId}:overview`;
}

export function CreateCategorySelectCustomId(
  interactionId: string,
  key: string,
): string {
  return `help:${interactionId}:select:${key}`;
}

export function CreateCategoryPageNavCustomId(
  interactionId: string,
  key: string,
  action: "first" | "prev" | "next" | "last",
  currentPage = 0,
): string {
  const targetPage =
    action === "first"
      ? 0
      : action === "last"
        ? currentPage
        : action === "prev"
          ? Math.max(currentPage - 1, 0)
          : Math.max(currentPage + 1, 0);

  return `help:${interactionId}:page:${key}:${action}:${targetPage}`;
}

export function ParseCategoryPageNavCustomId(customId: string): {
  interactionId: string;
  key: string;
  action: "first" | "prev" | "next" | "last";
  pageIndex: number;
} | null {
  const match = customId.match(
    /^help:(\d+):page:([\w-]+):(first|prev|next|last):(\d+)$/,
  );
  if (!match) {
    return null;
  }

  return {
    interactionId: match[1],
    key: match[2],
    action: match[3] as "first" | "prev" | "next" | "last",
    pageIndex: Number.parseInt(match[4], 10),
  };
}

export function ResolveHelpPageIndex(
  action: "first" | "prev" | "next" | "last",
  encodedPage: number,
  totalPages: number,
): number {
  if (totalPages <= 0) {
    return 0;
  }

  if (action === "first") {
    return 0;
  }

  if (action === "last") {
    return totalPages - 1;
  }

  return Math.max(0, Math.min(encodedPage, totalPages - 1));
}

export const HUB_SESSION_TIMEOUT_MS = 1000 * 60 * 15;

export type HubAction =
  | "home"
  | "ticket"
  | "help"
  | "stats"
  | "appeal"
  | "verify"
  | "staff-tickets"
  | "staff-appeals"
  | "staff-commands";

export function CreateHubActionCustomId(
  interactionId: string,
  action: HubAction,
): string {
  return `hub:${interactionId}:${action}`;
}

export function ParseHubActionCustomId(
  customId: string,
): { interactionId: string; action: HubAction } | null {
  const match = customId.match(
    /^hub:(\d+):(home|ticket|help|stats|appeal|verify|staff-tickets|staff-appeals|staff-commands)$/,
  );
  if (!match) {
    return null;
  }

  return {
    interactionId: match[1],
    action: match[2] as HubAction,
  };
}

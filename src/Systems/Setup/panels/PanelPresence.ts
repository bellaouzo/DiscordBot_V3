import type { Message, TextChannel } from "discord.js";

export async function ChannelHasPanelButton(
  channel: TextChannel,
  customIds: readonly string[],
): Promise<boolean> {
  const idSet = new Set(customIds);
  const messages = await channel.messages.fetch({ limit: 100 });

  for (const message of messages.values()) {
    if (MessageHasPanelButton(message, idSet)) {
      return true;
    }
  }

  return false;
}

export function MessageHasPanelButton(
  message: Message,
  customIds: ReadonlySet<string>,
): boolean {
  for (const row of message.components) {
    if (!("components" in row) || !Array.isArray(row.components)) {
      continue;
    }

    for (const component of row.components) {
      if (
        "customId" in component &&
        typeof component.customId === "string" &&
        customIds.has(component.customId)
      ) {
        return true;
      }
    }
  }

  return false;
}

export async function ChannelHasEmbedFooterMarker(
  channel: TextChannel,
  marker: string,
): Promise<boolean> {
  const messages = await channel.messages.fetch({ limit: 100 });

  for (const message of messages.values()) {
    for (const embed of message.embeds) {
      if (embed.footer?.text?.includes(marker)) {
        return true;
      }
    }
  }

  return false;
}

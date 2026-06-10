import type { MessageReaction } from "discord.js";

type EmojiLike = {
  id: string | null;
  name: string | null;
};

export function NormalizeReactionEmoji(emoji: EmojiLike): string {
  if (emoji.id) {
    return `${emoji.name}:${emoji.id}`;
  }

  return emoji.name ?? "";
}

export function ReactionMatchesEmoji(
  reaction: MessageReaction,
  configuredEmoji: string,
): boolean {
  return NormalizeReactionEmoji(reaction.emoji) === configuredEmoji;
}

export function FormatReactionEmojiForDisplay(emoji: string): string {
  const separatorIndex = emoji.indexOf(":");
  if (separatorIndex > 0 && separatorIndex < emoji.length - 1) {
    const name = emoji.slice(0, separatorIndex);
    const id = emoji.slice(separatorIndex + 1);
    return `<:${name}:${id}>`;
  }

  return emoji;
}

export function ParseMessageIdInput(input: string): string {
  const trimmed = input.trim();
  const linkMatch = trimmed.match(/discord\.com\/channels\/\d+\/\d+\/(\d+)/);
  if (linkMatch) {
    return linkMatch[1];
  }

  return trimmed;
}

import type { MessageCreateOptions } from "discord.js";

export const TAG_NAME_MAX_LENGTH = 32;
export const TAG_CONTENT_MAX_LENGTH = 2000;
export const TAG_LIMIT_PER_GUILD = 200;
export const TAG_PREFIX_MAX_LENGTH = 3;
/** Stored as `tag_prefix` to turn chat triggers off; `/tag show` keeps working. */
export const TAG_PREFIX_DISABLED = "off";

const TAG_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function NormalizeTagName(input: string): string {
  return input.trim().toLowerCase();
}

/** Returns an error message, or null when the (normalized) name is valid. */
export function ValidateTagName(name: string): string | null {
  if (name.length === 0 || name.length > TAG_NAME_MAX_LENGTH) {
    return `Tag names must be 1-${TAG_NAME_MAX_LENGTH} characters.`;
  }
  if (!TAG_NAME_PATTERN.test(name)) {
    return "Tag names may only use letters, numbers, `-` and `_`, and must start with a letter or number.";
  }
  return null;
}

/** Returns an error message, or null when the prefix is valid. */
export function ValidateTagPrefix(prefix: string): string | null {
  if (prefix === TAG_PREFIX_DISABLED) {
    return null;
  }
  if (prefix.length === 0 || prefix.length > TAG_PREFIX_MAX_LENGTH) {
    return `The prefix must be 1-${TAG_PREFIX_MAX_LENGTH} characters, or \`${TAG_PREFIX_DISABLED}\`.`;
  }
  if (/\s/.test(prefix) || prefix.startsWith("/")) {
    return "The prefix cannot contain spaces or start with `/`.";
  }
  return null;
}

/**
 * Finds the tag a chat message invokes, e.g. "!rules" or "!rules please" → "rules".
 * Returns null when the message does not start with the prefix or chat triggers are off.
 */
export function ParseTagTrigger(
  content: string,
  prefix: string,
): string | null {
  if (prefix === TAG_PREFIX_DISABLED || !content.startsWith(prefix)) {
    return null;
  }
  const name = NormalizeTagName(
    content.slice(prefix.length).split(/\s/, 1)[0] ?? "",
  );
  return ValidateTagName(name) === null ? name : null;
}

export interface TagRenderContext {
  readonly userId: string;
  readonly guildName: string;
  readonly channelId: string;
  readonly memberCount: number;
}

export function RenderTagContent(
  content: string,
  context: TagRenderContext,
): string {
  const placeholders: Record<string, string> = {
    "{user}": `<@${context.userId}>`,
    "{server}": context.guildName,
    "{channel}": `<#${context.channelId}>`,
    "{membercount}": context.memberCount.toLocaleString("en-US"),
  };
  const rendered = Object.entries(placeholders).reduce(
    (text, [placeholder, value]) => text.split(placeholder).join(value),
    content,
  );
  return rendered.length > TAG_CONTENT_MAX_LENGTH
    ? `${rendered.slice(0, TAG_CONTENT_MAX_LENGTH - 1)}…`
    : rendered;
}

/** Tags only ping the member who used them; `@everyone`, roles and other users stay silent. */
export function TagAllowedMentions(
  userId: string,
): MessageCreateOptions["allowedMentions"] {
  return { parse: [], users: [userId] };
}

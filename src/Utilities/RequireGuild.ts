import type { ChatInputCommandInteraction, Guild } from "discord.js";

interface GuildResolvableInteraction {
  readonly guild: Guild | null;
}

export function RequireGuild(interaction: ChatInputCommandInteraction): Guild {
  const guild = interaction.guild;
  if (!guild) {
    throw new Error("Expected guild context");
  }
  return guild;
}

export function RequireGuildFromInteraction(
  interaction: GuildResolvableInteraction,
): Guild {
  const guild = interaction.guild;
  if (!guild) {
    throw new Error("Expected guild context");
  }
  return guild;
}

export function RequireDefined<T>(
  value: T | null | undefined,
  message = "Expected value",
): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

import { EmbedFactory } from "@utilities";

export function ExtractErrorMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return undefined;
}

function FormatDiscordTimestamp(value: number | undefined): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }

  const seconds = Math.floor(value / 1000);
  return seconds > 0 ? `<t:${seconds}:f>` : null;
}

export function BuildStatusEmbed(options: {
  configured: boolean;
  linkedDiscordUserId?: string;
  keyType?: string;
  targetId?: string;
  createdAt?: number;
  updatedAt?: number;
}) {
  if (!options.configured) {
    return EmbedFactory.CreateError({
      title: "Roblox Not Connected",
      description:
        "No Roblox API key has been configured for this server. Run `/roblox connect` to set one up.",
    });
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Roblox Connected",
    description: "This server has a Roblox Open Cloud API key configured.",
  });

  if (options.linkedDiscordUserId) {
    embed.addFields([
      {
        name: "Configured By",
        value: `<@${options.linkedDiscordUserId}>`,
        inline: true,
      },
    ]);
  }

  if (options.keyType) {
    embed.addFields([
      {
        name: "Key Type",
        value: options.keyType === "group" ? "Group" : "User (Experience)",
        inline: true,
      },
    ]);
  }

  if (options.targetId) {
    const idLabel = options.keyType === "group" ? "Group ID" : "Universe ID";
    embed.addFields([
      {
        name: idLabel,
        value: options.targetId,
        inline: true,
      },
    ]);
  }

  const createdAtText = FormatDiscordTimestamp(options.createdAt);
  if (createdAtText) {
    embed.addFields([
      { name: "Created At", value: createdAtText, inline: true },
    ]);
  }

  const updatedAtText = FormatDiscordTimestamp(options.updatedAt);
  if (updatedAtText) {
    embed.addFields([
      { name: "Updated At", value: updatedAtText, inline: true },
    ]);
  }

  return embed;
}

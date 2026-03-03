import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import {
  EnsureAdminAccess,
  RequestApiKeyStatus,
  RequestApiKeyDelete,
  ExtractErrorMessage,
} from "@systems/Roblox/bridge";

export async function ExecuteDisconnectSubcommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  settings: RobloxBridgeSettings,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const hasAccess = await EnsureAdminAccess(interaction, context);
  if (!hasAccess) {
    return;
  }

  const guildId = interaction.guild!.id;

  const status = await RequestApiKeyStatus(settings, guildId);
  if (!status?.configured) {
    const embed = EmbedFactory.CreateError({
      title: "Nothing to Disconnect",
      description:
        "No Roblox API key is configured for this server. Run `/roblox connect` first.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    await RequestApiKeyDelete(settings, guildId);
  } catch (error) {
    const embed = EmbedFactory.CreateError({
      title: "Roblox Disconnect Failed",
      description:
        ExtractErrorMessage(error) ??
        "Unable to remove the Roblox API key. Please try again later.",
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guildId,
    roblox_linked_discord_user_id: null,
    roblox_linked_at: null,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Roblox Disconnected",
    description: "Successfully removed the Roblox API key for this server.",
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

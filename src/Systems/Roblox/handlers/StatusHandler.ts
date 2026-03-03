import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import {
  EnsureAdminAccess,
  RequestApiKeyStatus,
  BuildStatusEmbed,
} from "@systems/Roblox/bridge";

export async function ExecuteStatusSubcommand(
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
  const guildSettings = context.databases.serverDb.GetGuildSettings(guildId);
  const linkedDiscordUserId =
    guildSettings?.roblox_linked_discord_user_id?.trim() || undefined;

  const status = await RequestApiKeyStatus(settings, guildId);
  const configured = Boolean(status?.configured);

  if (!configured) {
    context.databases.serverDb.UpsertGuildSettings({
      guild_id: guildId,
      roblox_linked_discord_user_id: null,
      roblox_linked_at: null,
    });
  }

  const embed = BuildStatusEmbed({
    configured,
    linkedDiscordUserId: configured ? linkedDiscordUserId : undefined,
    keyType: status?.keyType,
    targetId: status?.targetId,
    createdAt: status?.createdAt,
    updatedAt: status?.updatedAt,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

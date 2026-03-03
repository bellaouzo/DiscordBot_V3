import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import {
  EnsureAdminAccess,
  RequestApiKeyStatus,
  BuildApiKeySetupUrl,
} from "@systems/Roblox/bridge";

export async function ExecuteConnectSubcommand(
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
  const currentUserId = interaction.user.id;

  const existingStatus = await RequestApiKeyStatus(settings, guildId);
  if (existingStatus?.configured) {
    const embed = EmbedFactory.CreateError({
      title: "API Key Already Configured",
      description:
        "A Roblox API key is already configured for this server. Run `/roblox disconnect` first to remove it.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const setupUrl = BuildApiKeySetupUrl(
    settings.url,
    guildId,
    currentUserId,
    settings.urlSigningSecret,
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Open Setup Page")
      .setStyle(ButtonStyle.Link)
      .setURL(setupUrl),
  );

  const embed = EmbedFactory.Create({
    title: "Connect Roblox API Key",
    description:
      "Click the button below to open the API key setup page. You will need your Roblox Open Cloud API key and your Universe ID (or Group ID).\n\nAfter completing setup, run `/roblox status` to verify.",
    footer: "After completing setup in browser, run /roblox status.",
  });

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guildId,
    roblox_linked_discord_user_id: currentUserId,
    roblox_linked_at: Date.now(),
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    components: [row.toJSON() as never],
    ephemeral: true,
  });
}

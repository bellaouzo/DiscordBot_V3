import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";

export {
  EnsureRobloxBridgeSettings,
  BuildApiKeySetupUrl,
} from "@systems/Roblox/bridgeSettings";

export {
  PostKickCommand,
  RequestApiKeyStatus,
  RequestApiKeyDelete,
  RequestGroupAudit,
  RequestGroupInfo,
  PollKickResult,
} from "@systems/Roblox/bridgeApi";

export { FindPlayerPresence } from "@systems/Roblox/bridgePresence";

export { BuildStatusEmbed, ExtractErrorMessage } from "@systems/Roblox/bridgeEmbeds";

export async function EnsureAdminAccess(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<boolean> {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const embed = EmbedFactory.CreateError({
    title: "Admin Only",
    description:
      "You need Administrator permission to manage Roblox API key settings.",
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

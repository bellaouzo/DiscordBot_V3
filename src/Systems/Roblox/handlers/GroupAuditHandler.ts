import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import {
  EnsureAdminAccess,
  RequestApiKeyStatus,
  RequestGroupAudit,
} from "@systems/Roblox/bridge";
import {
  GroupAuditErrorTitle,
  GroupAuditErrorMessage,
} from "@systems/Roblox/errors";

export async function ExecuteGroupAuditSubcommand(
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
  const player = interaction.options.getString("player", true).trim();
  if (!player) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Input",
      description: "Player name is required.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const status = await RequestApiKeyStatus(settings, guildId);
  if (!status?.configured) {
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle("NOT_CONNECTED"),
      description: GroupAuditErrorMessage("NOT_CONNECTED", ""),
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (status.keyType !== "group") {
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle("KEY_TYPE_EXPERIENCE"),
      description: GroupAuditErrorMessage("KEY_TYPE_EXPERIENCE", ""),
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    const result = await RequestGroupAudit(settings, guildId, { player });
    const data = result.data;
    const entries = data?.entries ?? [];
    const displayName = data?.player ?? data?.userId ?? player;
    const entryCount = Array.isArray(entries) ? entries.length : 0;

    const embed = EmbedFactory.CreateSuccess({
      title: "Group Audit",
      description: `Audit result for **${displayName}** in the linked group.`,
    });
    embed.addFields([
      { name: "Player", value: displayName, inline: true },
      { name: "Entries", value: String(entryCount), inline: true },
    ]);
    if (entryCount > 0 && Array.isArray(entries)) {
      const preview = entries.slice(0, 5).map((e, i) => {
        const row =
          typeof e === "object" && e !== null && "role" in e
            ? `${(e as { role?: string }).role ?? "—"}`
            : String(e);
        return `${i + 1}. ${row}`;
      }).join("\n");
      const more = entryCount > 5 ? `\n_… and ${entryCount - 5} more_` : "";
      embed.addFields([
        { name: "Details", value: preview + more, inline: false },
      ]);
    }

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    const message = (error as Error).message;
    const embed = EmbedFactory.CreateError({
      title: GroupAuditErrorTitle(code),
      description: GroupAuditErrorMessage(code, message),
    });
    if (code) {
      embed.addFields([{ name: "Code", value: code, inline: true }]);
    }
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

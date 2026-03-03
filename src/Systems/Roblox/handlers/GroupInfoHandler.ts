import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory } from "@utilities";
import type { RobloxBridgeSettings } from "@systems/Roblox/types";
import {
  EnsureAdminAccess,
  RequestApiKeyStatus,
  RequestGroupInfo,
} from "@systems/Roblox/bridge";
import {
  GroupAuditErrorTitle,
  GroupAuditErrorMessage,
} from "@systems/Roblox/errors";

export async function ExecuteGroupInfoSubcommand(
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
      title: GroupAuditErrorTitle("NO_GROUP_KEY"),
      description: GroupAuditErrorMessage("NO_GROUP_KEY", ""),
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  try {
    const result = await RequestGroupInfo(settings, guildId);
    const data = result.data;

    const embed = EmbedFactory.CreateSuccess({
      title: "Group Info",
      description: data?.displayName
        ? `**${data.displayName}**`
        : "Linked Roblox group.",
    });

    if (data?.id) {
      embed.addFields([{ name: "Group ID", value: data.id, inline: true }]);
    }
    if (data?.displayName) {
      embed.addFields([
        { name: "Name", value: data.displayName, inline: true },
      ]);
    }
    if (data?.memberCount !== undefined && data?.memberCount !== null) {
      embed.addFields([
        { name: "Members", value: String(data.memberCount), inline: true },
      ]);
    }
    if (data?.description !== undefined && data?.description !== "") {
      const desc =
        data.description.length > 1024
          ? `${data.description.slice(0, 1021)}...`
          : data.description;
      embed.addFields([{ name: "Description", value: desc, inline: false }]);
    }
    if (data?.path) {
      embed.addFields([{ name: "Path", value: data.path, inline: false }]);
    }
    if (data?.publicEntryAllowed !== undefined) {
      embed.addFields([
        {
          name: "Public Entry",
          value: data.publicEntryAllowed ? "Yes" : "No",
          inline: true,
        },
      ]);
    }
    if (data?.locked !== undefined) {
      embed.addFields([
        {
          name: "Locked",
          value: data.locked ? "Yes" : "No",
          inline: true,
        },
      ]);
    }
    if (data?.verified !== undefined) {
      embed.addFields([
        {
          name: "Verified",
          value: data.verified ? "Yes" : "No",
          inline: true,
        },
      ]);
    }
    if (data?.owner?.id) {
      embed.addFields([
        {
          name: "Owner ID",
          value: data.owner.id,
          inline: true,
        },
      ]);
    }
    if (data?.createTime) {
      embed.addFields([
        { name: "Created", value: data.createTime, inline: true },
      ]);
    }
    if (data?.updateTime) {
      embed.addFields([
        { name: "Updated", value: data.updateTime, inline: true },
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

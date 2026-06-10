import type { Guild, TextChannel } from "discord.js";
import type { ServerDatabase } from "@database";
import type { ReactionRoleMapping, ReactionRolePanel } from "@database/Server/Types";
import { EmbedFactory, FormatReactionEmojiForDisplay } from "@utilities";

type PanelResolveError = {
  title: string;
  description: string;
};

type PanelResolveSuccess = {
  panel: ReactionRolePanel;
};

export function BuildReactionRolePanelDescription(
  mappings: Array<Pick<ReactionRoleMapping, "emoji" | "role_id">>,
): string {
  const intro =
    "React below to get your roles. Remove your reaction to remove the role.";

  if (mappings.length === 0) {
    return `${intro}\n\n*No roles configured yet. Staff can add roles with \`/reactionrole add\`.*`;
  }

  const lines = mappings.map(
    (mapping) =>
      `${FormatReactionEmojiForDisplay(mapping.emoji)} — <@&${mapping.role_id}>`,
  );

  return `${intro}\n\n${lines.join("\n")}`;
}

export async function PanelMessageExists(
  guild: Guild,
  panel: ReactionRolePanel,
): Promise<boolean> {
  try {
    const channel = await guild.channels.fetch(panel.channel_id);
    if (!channel?.isTextBased()) {
      return false;
    }

    await (channel as TextChannel).messages.fetch(panel.message_id);
    return true;
  } catch {
    return false;
  }
}

export async function ListActiveReactionRolePanels(
  guild: Guild,
  panels: ReactionRolePanel[],
  serverDb: ServerDatabase,
): Promise<ReactionRolePanel[]> {
  const active: ReactionRolePanel[] = [];

  for (const panel of panels) {
    if (await PanelMessageExists(guild, panel)) {
      active.push(panel);
      continue;
    }

    serverDb.DeleteReactionRolePanel(panel.id);
  }

  return active;
}

export async function ResolveReactionRolePanel(
  guild: Guild,
  channelId: string | null,
  messageIdInput: string | null | undefined,
  serverDb: ServerDatabase,
  parseMessageId: (input: string) => string,
): Promise<PanelResolveSuccess | PanelResolveError> {
  if (messageIdInput) {
    const messageId = parseMessageId(messageIdInput);
    const panel = serverDb.GetReactionRolePanelByMessage(guild.id, messageId);

    if (!panel) {
      return {
        title: "Panel Not Found",
        description:
          "That message is not a reaction role panel. Use `/reactionrole panel` to create one, or paste the correct message link.",
      };
    }

    if (!(await PanelMessageExists(guild, panel))) {
      serverDb.DeleteReactionRolePanel(panel.id);
      return {
        title: "Panel Not Found",
        description:
          "That reaction role panel message was deleted. Create a new one with `/reactionrole panel`.",
      };
    }

    return { panel };
  }

  if (!channelId) {
    return {
      title: "Channel Required",
      description:
        "Run this command in the panel channel, or provide the panel `message_id`.",
    };
  }

  const panels = await ListActiveReactionRolePanels(
    guild,
    serverDb.ListReactionRolePanelsByChannel(guild.id, channelId),
    serverDb,
  );

  if (panels.length === 0) {
    return {
      title: "No Panel Here",
      description:
        "There is no reaction role panel in this channel. Run `/reactionrole panel` first.",
    };
  }

  if (panels.length > 1) {
    return {
      title: "Multiple Panels",
      description: [
        "This channel has multiple reaction role panels.",
        "Copy the panel message link and pass it as `message_id`, or run the command from a channel with only one panel.",
      ].join("\n"),
    };
  }

  return { panel: panels[0] };
}

export async function RefreshReactionRolePanel(
  guild: Guild,
  panel: ReactionRolePanel,
  mappings: ReactionRoleMapping[],
): Promise<void> {
  const channel = await guild.channels.fetch(panel.channel_id);
  if (!channel?.isTextBased()) {
    return;
  }

  const message = await (channel as TextChannel).messages.fetch(panel.message_id);
  const embed = EmbedFactory.Create({
    title: "Reaction Roles",
    description: BuildReactionRolePanelDescription(mappings),
    color: 0x5865f2,
  });

  await message.edit({ embeds: [embed.toJSON()] });
}

import type { ChatInputCommandInteraction, Message, TextChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import {
  RequireGuild,
  EmbedFactory,
  ValidateAssignableRole,
  ParseMessageIdInput,
  FormatReactionEmojiForDisplay,
} from "@utilities";
import type { PaginationPage } from "@shared/Paginator";
import type { ReactionRolePanel } from "@database/Server/Types";
import {
  BuildReactionRolePanelDescription,
  ListActiveReactionRolePanels,
  RefreshReactionRolePanel,
  ResolveReactionRolePanel,
} from "@systems/ReactionRole/ReactionRolePanelUtils";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

const LIST_PAGE_SIZE = 8;

function NormalizeEmojiInput(input: string): string {
  const trimmed = input.trim();
  const customMatch = trimmed.match(/^<a?:\w+:(\d+)>$/);
  if (customMatch) {
    const nameMatch = trimmed.match(/^<a?:([^:]+):\d+>$/);
    return `${nameMatch?.[1] ?? "emoji"}:${customMatch[1]}`;
  }

  return trimmed;
}

async function BuildPanelJumpLink(
  guild: ChatInputCommandInteraction["guild"],
  panel: ReactionRolePanel,
): Promise<string> {
  if (!guild) {
    return `<#${panel.channel_id}>`;
  }

  try {
    const channel = await guild.channels.fetch(panel.channel_id);
    if (!channel?.isTextBased()) {
      return `<#${panel.channel_id}>`;
    }

    const message = await (channel as TextChannel).messages.fetch(
      panel.message_id,
    );
    return `[Jump to panel](${message.url})`;
  } catch {
    return `<#${panel.channel_id}>`;
  }
}

async function FetchPanelMessage(
  guild: ChatInputCommandInteraction["guild"],
  panel: ReactionRolePanel,
): Promise<Message> {
  if (!guild) {
    throw new Error("Guild required");
  }

  const channel = await guild.channels.fetch(panel.channel_id);
  if (!channel?.isTextBased()) {
    throw new Error("Panel channel unavailable");
  }

  return (channel as TextChannel).messages.fetch(panel.message_id);
}

async function ExecutePanel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const channel = interaction.channel;

  if (!channel?.isTextBased()) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Reaction role panels must be posted in a text channel.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const panelEmbed = EmbedFactory.Create({
    title: "Reaction Roles",
    description: BuildReactionRolePanelDescription([]),
    color: 0x5865f2,
  });

  const message = await (channel as TextChannel).send({
    embeds: [panelEmbed.toJSON()],
  });

  context.databases.serverDb.CreateReactionRolePanel({
    guild_id: guild.id,
    channel_id: channel.id,
    message_id: message.id,
    created_by: interaction.user.id,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Panel Created",
    description: [
      `Reaction role panel posted in ${channel}.`,
      "",
      "Add roles with:",
      "`/reactionrole add emoji:🎮 role:@YourRole`",
      "",
      "Run the command in this channel, or pass the panel message link as `message_id` if you have multiple panels.",
    ].join("\n"),
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteAdd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const emojiInput = interaction.options.getString("emoji", true);
  const roleOption = interaction.options.getRole("role", true);
  const messageIdInput = interaction.options.getString("message_id");
  const role = await guild.roles.fetch(roleOption.id);
  const emoji = NormalizeEmojiInput(emojiInput);

  const validation = ValidateAssignableRole(guild, role);
  if (!validation.valid) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Role",
      description: validation.reason,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const resolved = await ResolveReactionRolePanel(
    guild,
    interaction.channel?.id ?? null,
    messageIdInput,
    context.databases.serverDb,
    ParseMessageIdInput,
  );

  if (!("panel" in resolved)) {
    const embed = EmbedFactory.CreateWarning({
      title: resolved.title,
      description: resolved.description,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { panel } = resolved;

  const existing = context.databases.serverDb.GetReactionRoleMappingByPanelAndEmoji(
    panel.id,
    emoji,
  );

  if (existing) {
    const embed = EmbedFactory.CreateWarning({
      title: "Emoji Already Used",
      description: `${FormatReactionEmojiForDisplay(emoji)} is already mapped on this panel.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const message = await FetchPanelMessage(guild, panel);
    await message.react(emojiInput.trim());

    context.databases.serverDb.AddReactionRoleMapping({
      panel_id: panel.id,
      emoji,
      role_id: roleOption.id,
    });

    const mappings = context.databases.serverDb.ListReactionRoleMappings(panel.id);
    await RefreshReactionRolePanel(guild, panel, mappings);

    const embed = EmbedFactory.CreateSuccess({
      title: "Role Added",
      description: `${FormatReactionEmojiForDisplay(emoji)} now assigns ${roleOption}.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    context.logger.Error("Failed to add reaction role mapping", { error });
    const embed = EmbedFactory.CreateError({
      title: "Add Failed",
      description: "Could not add the reaction role mapping.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function ExecuteRemove(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const emojiInput = interaction.options.getString("emoji", true);
  const messageIdInput = interaction.options.getString("message_id");
  const emoji = NormalizeEmojiInput(emojiInput);

  const resolved = await ResolveReactionRolePanel(
    guild,
    interaction.channel?.id ?? null,
    messageIdInput,
    context.databases.serverDb,
    ParseMessageIdInput,
  );

  if (!("panel" in resolved)) {
    const embed = EmbedFactory.CreateWarning({
      title: resolved.title,
      description: resolved.description,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { panel } = resolved;
  const removed = context.databases.serverDb.RemoveReactionRoleMappingByPanelAndEmoji(
    panel.id,
    emoji,
  );

  if (!removed) {
    const embed = EmbedFactory.CreateWarning({
      title: "Mapping Not Found",
      description: `${FormatReactionEmojiForDisplay(emoji)} is not mapped on this panel.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const message = await FetchPanelMessage(guild, panel);
    const reaction = message.reactions.resolve(emojiInput.trim());
    if (reaction) {
      await reaction.remove().catch(() => null);
    }

    const mappings = context.databases.serverDb.ListReactionRoleMappings(panel.id);
    await RefreshReactionRolePanel(guild, panel, mappings);

    const embed = EmbedFactory.CreateSuccess({
      title: "Role Removed",
      description: `Removed ${FormatReactionEmojiForDisplay(emoji)} from the panel.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    context.logger.Error("Failed to remove reaction role mapping", { error });
    const embed = EmbedFactory.CreateError({
      title: "Remove Failed",
      description: "Mapping was removed from the database, but the panel message could not be updated.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function BuildPanelListPages(
  guild: ChatInputCommandInteraction["guild"],
  panels: ReactionRolePanel[],
  serverDb: CommandContext["databases"]["serverDb"],
): Promise<PaginationPage[]> {
  if (panels.length === 0) {
    const embed = EmbedFactory.Create({
      title: "Reaction Role Panels",
      description:
        "No reaction role panels configured. Run `/reactionrole panel` in a channel to create one.",
    });
    return [{ embeds: [embed.toJSON()] }];
  }

  const pages: PaginationPage[] = [];

  for (let index = 0; index < panels.length; index += LIST_PAGE_SIZE) {
    const slice = panels.slice(index, index + LIST_PAGE_SIZE);
    const embed = EmbedFactory.Create({
      title: "Reaction Role Panels",
      description: `Showing ${index + 1}-${index + slice.length} of ${panels.length}`,
    });

    for (const panel of slice) {
      const mappings = serverDb.ListReactionRoleMappings(panel.id);
      const link = await BuildPanelJumpLink(guild, panel);
      const mappingLines =
        mappings.length === 0
          ? "*No roles configured*"
          : mappings
              .map(
                (mapping) =>
                  `${FormatReactionEmojiForDisplay(mapping.emoji)} — <@&${mapping.role_id}>`,
              )
              .join("\n");

      embed.addFields({
        name: `<#${panel.channel_id}>`,
        value: `${link}\n${mappingLines}`,
        inline: false,
      });
    }

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

async function ExecuteList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const panels = await ListActiveReactionRolePanels(
    guild,
    context.databases.serverDb.ListReactionRolePanels(guild.id),
    context.databases.serverDb,
  );
  const pages = await BuildPanelListPages(
    guild,
    panels,
    context.databases.serverDb,
  );

  await context.responders.paginatedResponder.Send({
    interaction,
    pages,
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

export const ReactionRoleCommand = CreateCommand({
  name: "reactionrole",
  description: "Manage reaction role panels",
  group: "utility",
  config: Config.mod(3).build(),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("panel")
          .setDescription("Post a reaction role panel in this channel"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add an emoji-to-role mapping to a panel")
          .addStringOption((option) =>
            option
              .setName("emoji")
              .setDescription("Emoji users react with (e.g. 🎮)")
              .setRequired(true),
          )
          .addRoleOption((option) =>
            option
              .setName("role")
              .setDescription("Role to assign")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("message_id")
              .setDescription(
                "Panel message ID or link (only needed if the channel has multiple panels)",
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove an emoji-to-role mapping from a panel")
          .addStringOption((option) =>
            option
              .setName("emoji")
              .setDescription("Emoji to remove from the panel")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("message_id")
              .setDescription(
                "Panel message ID or link (only needed if the channel has multiple panels)",
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List panels and their emoji-to-role mappings"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("about")
          .setDescription("Learn what reaction roles are and how to set them up"),
      );
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);
    if (sub === "panel") {
      await ExecutePanel(interaction, context);
    } else if (sub === "add") {
      await ExecuteAdd(interaction, context);
    } else if (sub === "remove") {
      await ExecuteRemove(interaction, context);
    } else if (sub === "list") {
      await ExecuteList(interaction, context);
    } else if (sub === "about") {
      await ReplyWithFeatureAbout(interaction, context, "reactionrole");
    }
  },
});

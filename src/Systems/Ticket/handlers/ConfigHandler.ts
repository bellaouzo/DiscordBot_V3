import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import {
  RequireGuild,
  EmbedFactory,
  ResolveInteractionMember,
} from "@utilities";
import {
  CreateTicketServices,
  HasStaffPermissions,
  ValidateGuildOrReply,
} from "@systems/Ticket/validation/TicketValidation";

export async function HandleTicketConfig(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateGuildOrReply(interaction, interactionResponder))) {
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    RequireGuild(interaction).id,
  );
  const member = await ResolveInteractionMember(interaction);

  if (
    !HasStaffPermissions(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You need staff permissions to manage ticket categories.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const action = interaction.options.getSubcommand(true);
  const { ticketDb } = CreateTicketServices(
    logger,
    RequireGuild(interaction),
    context.databases.ticketDb,
    context.databases.serverDb,
  );
  const guildId = RequireGuild(interaction).id;

  if (action === "list") {
    const categories = ticketDb.EnsureCategoryConfigs(guildId);
    const embed = EmbedFactory.Create({
      title: "Ticket Categories",
      description:
        categories.length === 0
          ? "No ticket categories configured."
          : `**${categories.length}** configured categor${
              categories.length !== 1 ? "ies" : "y"
            }.`,
      color: 0x5865f2,
    });

    if (categories.length > 0) {
      const lines = categories.map(
        (cat) =>
          `${cat.emoji} **${cat.label}** (\`${cat.value}\`) — ${cat.description}`,
      );
      embed.addFields({
        name: "Categories",
        value: lines.join("\n"),
        inline: false,
      });
    }

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "add") {
    const value = interaction.options.getString("value", true);
    const label = interaction.options.getString("label", true);
    const description = interaction.options.getString("description") ?? label;
    const emoji = interaction.options.getString("emoji") ?? "📝";

    const existing = ticketDb.GetCategoryConfig(guildId, value);
    if (existing) {
      const embed = EmbedFactory.CreateError({
        title: "Category Exists",
        description: `A category with value \`${value}\` already exists.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    ticketDb.AddCategoryConfig({
      guild_id: guildId,
      value,
      label,
      description,
      emoji,
    });

    const embed = EmbedFactory.CreateSuccess({
      title: "Category Added",
      description: `Added ticket category **${label}** (\`${value}\`).`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "edit") {
    const value = interaction.options.getString("value", true);
    const existing = ticketDb.GetCategoryConfig(guildId, value);

    if (!existing) {
      const embed = EmbedFactory.CreateError({
        title: "Category Not Found",
        description: `No category found with value \`${value}\`.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const label = interaction.options.getString("label");
    const description = interaction.options.getString("description");
    const emoji = interaction.options.getString("emoji");

    if (!label && !description && !emoji) {
      const embed = EmbedFactory.CreateError({
        title: "Nothing to Update",
        description: "Provide at least one field to edit.",
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    ticketDb.UpdateCategoryConfig(guildId, value, {
      label: label ?? undefined,
      description: description ?? undefined,
      emoji: emoji ?? undefined,
    });

    const embed = EmbedFactory.CreateSuccess({
      title: "Category Updated",
      description: `Updated ticket category \`${value}\`.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "remove") {
    const value = interaction.options.getString("value", true);
    const removed = ticketDb.RemoveCategoryConfig(guildId, value);

    if (!removed) {
      const embed = EmbedFactory.CreateError({
        title: "Category Not Found",
        description: `No category found with value \`${value}\`.`,
      });
      await interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "Category Removed",
      description: `Removed ticket category \`${value}\`.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

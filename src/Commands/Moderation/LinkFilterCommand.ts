import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { LinkFilterType } from "@database";

function NormalizePattern(input: string): string {
  return input.trim().toLowerCase();
}

function DescribeFilters(patterns: string[]): string {
  if (patterns.length === 0) {
    return "None";
  }
  return patterns.slice(0, 20).join(", ");
}

async function AddFilter(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  type: LinkFilterType
): Promise<void> {
  const guild = interaction.guild!;
  const pattern = NormalizePattern(
    interaction.options.getString("pattern", true)
  );

  if (pattern.length === 0) {
    const embed = EmbedFactory.CreateError({
      title: "Empty Pattern",
      description: "Provide a pattern to allow or block.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const db = context.databases.moderationDb;
  try {
    const existing = db
      .ListLinkFilters(guild.id)
      .find((filter) => filter.type === type && filter.pattern === pattern);

    if (existing) {
      const embed = EmbedFactory.CreateWarning({
        title: "Already Added",
        description: `Pattern \`${pattern}\` already exists in ${type} list.`,
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    db.AddLinkFilter({
      guild_id: guild.id,
      pattern,
      type,
      created_by: interaction.user.id,
    });

    const embed = EmbedFactory.CreateSuccess({
      title: "Link Filter Updated",
      description: `Added \`${pattern}\` to the ${type} list.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to add link filter", { error });
    const embed = EmbedFactory.CreateError({
      title: "Add Failed",
      description: "Could not save the pattern. Try again.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

async function RemoveFilter(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const guild = interaction.guild!;
  const pattern = NormalizePattern(
    interaction.options.getString("pattern", true)
  );
  const type = interaction.options.getString("type", true) as LinkFilterType;

  const db = context.databases.moderationDb;
  try {
    const removed = db.RemoveLinkFilter({
      guild_id: guild.id,
      pattern,
      type,
    });

    if (!removed) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Found",
        description: `No \`${type}\` pattern found for \`${pattern}\`.`,
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const embed = EmbedFactory.CreateSuccess({
      title: "Link Filter Updated",
      description: `Removed \`${pattern}\` from the ${type} list.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to remove link filter", { error });
    const embed = EmbedFactory.CreateError({
      title: "Remove Failed",
      description: "Could not remove the pattern. Try again.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

async function ListFilters(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const guild = interaction.guild!;

  const db = context.databases.moderationDb;
  try {
    const filters = db.ListLinkFilters(guild.id);
    const allow = filters
      .filter((f) => f.type === "allow")
      .map((f) => f.pattern);
    const block = filters
      .filter((f) => f.type === "block")
      .map((f) => f.pattern);

    const embed = EmbedFactory.Create({
      title: "🔗 Link Filters",
      description: "Allow list takes priority over block list.",
    });

    embed.addFields(
      {
        name: "Allow",
        value: DescribeFilters(allow),
        inline: false,
      },
      {
        name: "Block",
        value: DescribeFilters(block),
        inline: false,
      }
    );

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to list link filters", { error });
    const embed = EmbedFactory.CreateError({
      title: "List Failed",
      description: "Could not fetch link filters.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

async function ExecuteLinkFilter(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const sub = interaction.options.getSubcommand(true);

  if (sub === "allow") {
    await AddFilter(interaction, context, "allow");
    return;
  }

  if (sub === "block") {
    await AddFilter(interaction, context, "block");
    return;
  }

  if (sub === "remove") {
    await RemoveFilter(interaction, context);
    return;
  }

  if (sub === "list") {
    await ListFilters(interaction, context);
    return;
  }
}

export const LinkFilterCommand = CreateCommand({
  name: "linkfilter",
  description: "Manage link allow/block lists",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteLinkFilter,
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("allow")
          .setDescription("Add an allow pattern")
          .addStringOption((option) =>
            option
              .setName("pattern")
              .setDescription("Substring to allow (case-insensitive)")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("block")
          .setDescription("Add a block pattern")
          .addStringOption((option) =>
            option
              .setName("pattern")
              .setDescription("Substring to block (case-insensitive)")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a stored pattern")
          .addStringOption((option) =>
            option
              .setName("pattern")
              .setDescription("Substring to remove")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("type")
              .setDescription("List to remove from")
              .setRequired(true)
              .addChoices(
                { name: "allow", value: "allow" },
                { name: "block", value: "block" }
              )
          )
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("Show stored patterns")
      );
  },
});

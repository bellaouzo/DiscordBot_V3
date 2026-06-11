import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { AllCommands, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { IsProtectedCommand } from "@middleware/ProtectedCommands";
import { RequireGuild, EmbedFactory } from "@utilities";
import type { PaginationPage } from "@shared/Paginator";

const DISABLED_LIST_PAGE_SIZE = 10;

function ResolveCommandName(
  interaction: ChatInputCommandInteraction,
): string {
  return interaction.options.getString("name", true).trim().toLowerCase();
}

function ValidateCommandName(commandName: string): string | null {
  const exists = AllCommands().some((cmd) => cmd.data.name === commandName);
  if (!exists) {
    return "That command does not exist.";
  }
  if (IsProtectedCommand(commandName)) {
    return "That command cannot be disabled.";
  }
  return null;
}

async function ExecuteDisable(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const commandName = ResolveCommandName(interaction);
  const validationError = ValidateCommandName(commandName);

  if (validationError) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Command",
      description: validationError,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (context.databases.serverDb.IsCommandDisabled(guild.id, commandName)) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Disabled",
      description: `\`/${commandName}\` is already disabled in this server.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  context.databases.serverDb.DisableCommand(guild.id, commandName);

  const embed = EmbedFactory.CreateSuccess({
    title: "Command Disabled",
    description: `\`/${commandName}\` is now disabled in this server.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteEnable(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const commandName = ResolveCommandName(interaction);
  const validationError = ValidateCommandName(commandName);

  if (validationError && validationError === "That command does not exist.") {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Command",
      description: validationError,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const enabled = context.databases.serverDb.EnableCommand(
    guild.id,
    commandName,
  );

  if (!enabled) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Disabled",
      description: `\`/${commandName}\` is not disabled in this server.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Command Enabled",
    description: `\`/${commandName}\` is now enabled in this server.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

function BuildDisabledCommandPages(commands: string[]): PaginationPage[] {
  if (commands.length === 0) {
    return [
      {
        embeds: [
          EmbedFactory.Create({
            title: "Disabled Commands",
            description: "No commands are disabled in this server.",
          }).toJSON(),
        ],
      },
    ];
  }

  const pages: PaginationPage[] = [];
  for (let i = 0; i < commands.length; i += DISABLED_LIST_PAGE_SIZE) {
    const chunk = commands.slice(i, i + DISABLED_LIST_PAGE_SIZE);
    const pageIndex = Math.floor(i / DISABLED_LIST_PAGE_SIZE) + 1;
    const totalPages = Math.ceil(commands.length / DISABLED_LIST_PAGE_SIZE);

    const embed = EmbedFactory.Create({
      title: "Disabled Commands",
      description: chunk.map((name) => `\`/${name}\``).join("\n"),
      footer: `Page ${pageIndex} of ${totalPages}`,
    });

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

async function ExecuteList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const disabled = context.databases.serverDb.ListDisabledCommands(guild.id);
  const pages = BuildDisabledCommandPages(disabled);

  await context.responders.paginatedResponder.Send({
    interaction,
    pages,
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

async function ExecuteView(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const commandName = ResolveCommandName(interaction);
  const exists = AllCommands().some((cmd) => cmd.data.name === commandName);

  if (!exists) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Command",
      description: "That command does not exist.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const isProtected = IsProtectedCommand(commandName);
  const isDisabled = context.databases.serverDb.IsCommandDisabled(
    guild.id,
    commandName,
  );

  const status = isProtected
    ? "Protected (always enabled)"
    : isDisabled
      ? "Disabled"
      : "Enabled";

  const embed = EmbedFactory.Create({
    title: `Command: /${commandName}`,
    description: `Status: **${status}**`,
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

export const CommandCommand = CreateCommand({
  name: "command",
  description: "Enable or disable slash commands in this server",
  group: "utility",
  config: Config.admin(3),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("disable")
          .setDescription("Disable a slash command in this server")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Command name (without the slash)")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("enable")
          .setDescription("Re-enable a disabled slash command")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Command name (without the slash)")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List disabled commands"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("Check if a command is enabled or disabled")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Command name (without the slash)")
              .setRequired(true),
          ),
      );
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);

    if (sub === "disable") {
      await ExecuteDisable(interaction, context);
      return;
    }
    if (sub === "enable") {
      await ExecuteEnable(interaction, context);
      return;
    }
    if (sub === "list") {
      await ExecuteList(interaction, context);
      return;
    }
    if (sub === "view") {
      await ExecuteView(interaction, context);
    }
  },
});

import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import {
  RequireGuild,
  EmbedFactory,
  ValidateAssignableRole,
  AppendFeatureGuideHint,
} from "@utilities";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

async function ExecuteSet(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const roleOption = interaction.options.getRole("role", true);
  const role = await guild.roles.fetch(roleOption.id);
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

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    autorole_id: roleOption.id,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Autorole Set",
    description: `New members will receive ${roleOption}.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteClear(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    autorole_id: null,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Autorole Cleared",
    description: "New members will no longer receive an automatic role.",
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteView(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const embed = EmbedFactory.Create({
    title: "Autorole",
    description: settings?.autorole_id
      ? `New members receive <@&${settings.autorole_id}>.`
      : "No autorole is configured.",
  });
  AppendFeatureGuideHint(embed, "autorole");
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

export const AutoroleCommand = CreateCommand({
  name: "autorole",
  description: "Configure automatic role assignment for new members",
  group: "utility",
  config: Config.mod(3).build(),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Set the role assigned to new members")
          .addRoleOption((option) =>
            option
              .setName("role")
              .setDescription("Role to assign on join")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("clear").setDescription("Remove the autorole"),
      )
      .addSubcommand((sub) =>
        sub.setName("view").setDescription("View the current autorole"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("about")
          .setDescription("Learn what autorole is and how to set it up"),
      );
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);
    if (sub === "set") {
      await ExecuteSet(interaction, context);
    } else if (sub === "clear") {
      await ExecuteClear(interaction, context);
    } else if (sub === "view") {
      await ExecuteView(interaction, context);
    } else if (sub === "about") {
      await ReplyWithFeatureAbout(interaction, context, "autorole");
    }
  },
});

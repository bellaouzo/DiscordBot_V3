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
import { HandleVerificationPanel } from "@systems/Verification/VerificationPanelFlow";
import { VerifyGuildMember } from "@systems/Verification/VerifyMember";

function BuildVerificationEmbed(
  guildId: string,
  context: CommandContext,
): ReturnType<typeof EmbedFactory.Create> {
  const settings = context.databases.serverDb.GetGuildSettings(guildId);
  const embed = EmbedFactory.Create({
    title: "Verification Settings",
    description: settings?.verification_enabled
      ? "Verification is **enabled** for this server."
      : "Verification is **disabled** for this server.",
  });

  embed.addFields(
    {
      name: "Unverified role",
      value: settings?.unverified_role_id
        ? `<@&${settings.unverified_role_id}>`
        : "Not set",
      inline: true,
    },
    {
      name: "Verified role",
      value: settings?.verified_role_id
        ? `<@&${settings.verified_role_id}>`
        : "Not set",
      inline: true,
    },
    {
      name: "Min account age",
      value: settings?.verification_min_account_age_days
        ? `${settings.verification_min_account_age_days} day(s)`
        : "None",
      inline: true,
    },
    {
      name: "Verification channel",
      value: settings?.verification_channel_id
        ? `<#${settings.verification_channel_id}>`
        : "Not set",
      inline: true,
    },
  );

  AppendFeatureGuideHint(embed, "verification");
  return embed;
}

async function ExecuteEnable(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);

  if (!settings?.unverified_role_id) {
    const embed = EmbedFactory.CreateWarning({
      title: "Unverified Role Required",
      description:
        "Set an unverified role with `/verify set` before enabling verification.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    verification_enabled: true,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Verification Enabled",
    description: "New members will receive the unverified role until they verify.",
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteDisable(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    verification_enabled: false,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Verification Disabled",
    description: "New members will no longer be held for verification.",
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteSet(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const unverifiedRole = interaction.options.getRole("unverified-role");
  const verifiedRole = interaction.options.getRole("verified-role");
  const minAge = interaction.options.getInteger("min-account-age");

  if (!unverifiedRole && !verifiedRole && minAge === null) {
    const embed = EmbedFactory.CreateWarning({
      title: "Nothing To Update",
      description: "Provide at least one setting to change.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (unverifiedRole) {
    const role = await guild.roles.fetch(unverifiedRole.id);
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
  }

  if (verifiedRole) {
    const role = await guild.roles.fetch(verifiedRole.id);
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
  }

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    unverified_role_id: unverifiedRole?.id,
    verified_role_id: verifiedRole?.id,
    verification_min_account_age_days: minAge ?? undefined,
  });

  const embed = BuildVerificationEmbed(guild.id, context);
  embed.setTitle("Verification Settings Updated");
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
    verification_enabled: false,
    unverified_role_id: null,
    verified_role_id: null,
    verification_min_account_age_days: 0,
    verification_channel_id: null,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Verification Cleared",
    description: "Verification settings have been reset.",
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
  const embed = BuildVerificationEmbed(guild.id, context);
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function ExecuteForce(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const targetUser = interaction.options.getUser("user", true);
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);

  if (!settings?.verification_enabled) {
    const embed = EmbedFactory.CreateWarning({
      title: "Verification Disabled",
      description: "Verification is not enabled in this server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await guild.members.fetch(targetUser.id);
  const result = await VerifyGuildMember({
    member,
    settings,
    skipAccountAgeCheck: true,
  });

  if (!result.success) {
    const embed = EmbedFactory.CreateError({
      title: "Verification Failed",
      description: result.reason,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = EmbedFactory.CreateSuccess({
    title: "Member Verified",
    description: `${targetUser} has been manually verified.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

export const VerificationCommand = CreateCommand({
  name: "verify",
  description: "Configure member verification for this server",
  group: "utility",
  config: Config.mod(3).build(),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("enable")
          .setDescription("Enable verification for new members"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("disable")
          .setDescription("Disable verification for new members"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Configure verification roles and requirements")
          .addRoleOption((option) =>
            option
              .setName("unverified-role")
              .setDescription("Role assigned to new unverified members"),
          )
          .addRoleOption((option) =>
            option
              .setName("verified-role")
              .setDescription("Role granted after verification"),
          )
          .addIntegerOption((option) =>
            option
              .setName("min-account-age")
              .setDescription("Minimum account age in days (0 = none)")
              .setMinValue(0)
              .setMaxValue(365),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("clear")
          .setDescription("Clear all verification settings"),
      )
      .addSubcommand((sub) =>
        sub.setName("view").setDescription("View verification settings"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("panel")
          .setDescription("Post a verification panel in this channel"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("force")
          .setDescription("Manually verify a member")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Member to verify")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("about")
          .setDescription("Learn what verification is and how to set it up"),
      );
  },
  execute: async (interaction, context) => {
    const sub = interaction.options.getSubcommand(true);

    if (sub === "enable") {
      await ExecuteEnable(interaction, context);
      return;
    }
    if (sub === "disable") {
      await ExecuteDisable(interaction, context);
      return;
    }
    if (sub === "set") {
      await ExecuteSet(interaction, context);
      return;
    }
    if (sub === "clear") {
      await ExecuteClear(interaction, context);
      return;
    }
    if (sub === "view") {
      await ExecuteView(interaction, context);
      return;
    }
    if (sub === "panel") {
      await HandleVerificationPanel(interaction, context);
      return;
    }
    if (sub === "force") {
      await ExecuteForce(interaction, context);
      return;
    }
    if (sub === "about") {
      await ReplyWithFeatureAbout(interaction, context, "verification");
    }
  },
});

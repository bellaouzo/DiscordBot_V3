import type { APIEmbed, Guild, GuildMember } from "discord.js";
import type { GuildSettings } from "@database/Server/Types";
import { EmbedFactory } from "@utilities";
import type { VerificationEligibility } from "@systems/Verification/VerifyMember";

export function CollectVerificationGrantRoleIds(
  settings: GuildSettings,
): string[] {
  const roleIds: string[] = [];

  if (settings.verified_role_id) {
    roleIds.push(settings.verified_role_id);
  }

  if (
    settings.autorole_id &&
    settings.autorole_id !== settings.verified_role_id
  ) {
    roleIds.push(settings.autorole_id);
  }

  return roleIds;
}

function FormatRequirementLines(settings: GuildSettings): string {
  const lines: string[] = [
    "• You must have the unverified member role",
    "• Click **Begin Verification** and confirm you agree to the rules",
  ];

  if (settings.verification_min_account_age_days > 0) {
    lines.push(
      `• Your Discord account must be at least **${settings.verification_min_account_age_days}** day(s) old`,
    );
  }

  return lines.join("\n");
}

function FormatRewardLines(settings: GuildSettings): string {
  const lines: string[] = ["• Access to the rest of the server"];
  const grantRoleIds = CollectVerificationGrantRoleIds(settings);

  grantRoleIds.forEach((roleId) => {
    lines.push(`• Receive <@&${roleId}>`);
  });

  return lines.join("\n");
}

export function BuildVerificationPanelEmbed(
  guild: Guild,
  settings: GuildSettings,
): APIEmbed {
  const embed = EmbedFactory.Create({
    title: `Welcome to ${guild.name}`,
    description:
      "Thanks for joining! Complete verification below to unlock the full server.",
    color: 0x5865f2,
    thumbnail: guild.iconURL() ?? undefined,
    timestamp: true,
  });

  embed.addFields(
    {
      name: "📋 How to verify",
      value:
        "**1.** Read the server rules\n" +
        "**2.** Click **Check Eligibility** to see if you qualify\n" +
        "**3.** Click **Begin Verification** and confirm you agree\n" +
        "**4.** Enjoy the community!",
      inline: false,
    },
    {
      name: "✅ Requirements",
      value: FormatRequirementLines(settings),
      inline: true,
    },
    {
      name: "🎁 After verification",
      value: FormatRewardLines(settings),
      inline: true,
    },
  );

  embed.setFooter({
    text: `${guild.memberCount} members • Verification required`,
  });

  return embed.toJSON();
}

export function BuildEligibilityEmbed(
  member: GuildMember,
  eligibility: VerificationEligibility,
): APIEmbed {
  if (eligibility.alreadyVerified) {
    const embed = EmbedFactory.CreateSuccess({
      title: "Already Verified",
      description: `${member}, you already have full access to this server.`,
    });
    return embed.toJSON();
  }

  if (!eligibility.unverifiedRoleConfigured) {
    const embed = EmbedFactory.CreateWarning({
      title: "Verification Not Ready",
      description:
        "This server has verification enabled, but no **unverified role** is configured. " +
        "Staff need to set that role in `/setup` (it is the role new members get until they verify).",
    });
    return embed.toJSON();
  }

  const ageLine =
    eligibility.minAccountAgeDays > 0
      ? eligibility.eligible
        ? `✅ Account age: **${eligibility.accountAgeDays}** day(s) (required: ${eligibility.minAccountAgeDays})`
        : `❌ Account age: **${eligibility.accountAgeDays}** day(s) — need **${eligibility.minAccountAgeDays}** (come back in **${eligibility.daysRemaining}** day(s))`
      : `✅ Account age: **${eligibility.accountAgeDays}** day(s)`;

  const roleLine = eligibility.hasUnverifiedRole
    ? "✅ Unverified role detected — you can complete verification"
    : "❌ You do not have the unverified role. Rejoin the server or ask staff to assign it.";

  const embed = EmbedFactory.Create({
    title: eligibility.eligible ? "You're eligible!" : "Not eligible yet",
    description: eligibility.eligible
      ? "You meet all requirements. Click **Begin Verification** on the panel when you're ready."
      : "You don't meet every requirement yet. Check the details below.",
    color: eligibility.eligible ? 0x57f287 : 0xfee75c,
    thumbnail: member.user.displayAvatarURL(),
  });

  embed.addFields(
    { name: "Account", value: ageLine, inline: false },
    { name: "Status", value: roleLine, inline: false },
    {
      name: "Joined server",
      value: member.joinedAt
        ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
        : "Unknown",
      inline: true,
    },
    {
      name: "Account created",
      value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      inline: true,
    },
  );

  return embed.toJSON();
}

export function BuildVerificationConfirmEmbed(
  member: GuildMember,
  settings: GuildSettings,
  eligibility: VerificationEligibility,
): APIEmbed {
  const embed = EmbedFactory.Create({
    title: "Confirm verification",
    description: `Hey ${member}, please confirm you're ready to join **${member.guild.name}**.`,
    color: 0x5865f2,
    thumbnail: member.guild.iconURL() ?? undefined,
  });

  embed.addFields(
    {
      name: "📜 Before you continue",
      value:
        "By verifying, you confirm that you:\n" +
        "• Have read and will follow the server rules\n" +
        "• Understand this is a community server with active moderation\n" +
        "• Are not using an alt to evade a ban",
      inline: false,
    },
    {
      name: "Your status",
      value: eligibility.eligible
        ? "✅ All requirements met — tap the button below to finish."
        : "⚠️ You may not meet every requirement. Verification might fail.",
      inline: false,
    },
  );

  const grantRoleIds = CollectVerificationGrantRoleIds(settings);
  if (grantRoleIds.length > 0) {
    embed.addFields({
      name: "Roles you'll receive",
      value: grantRoleIds.map((roleId) => `<@&${roleId}>`).join(", "),
      inline: false,
    });
  }

  return embed.toJSON();
}

export function BuildVerificationSuccessEmbed(
  member: GuildMember,
  settings: GuildSettings,
): APIEmbed {
  const embed = EmbedFactory.CreateSuccess({
    title: "Welcome aboard!",
    description: `${member}, you're verified and have full access to **${member.guild.name}**.`,
    thumbnail: member.user.displayAvatarURL(),
  });

  const grantRoleIds = CollectVerificationGrantRoleIds(settings);
  if (grantRoleIds.length > 0) {
    embed.addFields({
      name: "Roles granted",
      value: grantRoleIds.map((roleId) => `<@&${roleId}>`).join(", "),
      inline: false,
    });
  }

  embed.addFields({
    name: "What's next?",
    value:
      "Explore the channels, say hello, and have fun. Use `/hub open` for quick shortcuts.",
    inline: false,
  });

  return embed.toJSON();
}

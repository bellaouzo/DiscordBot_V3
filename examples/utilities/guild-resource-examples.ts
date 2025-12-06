import { ChatInputCommandInteraction, Guild } from "discord.js";
import { Logger } from "../../src/Shared/Logger";
import { CreateGuildResourceLocator } from "../../src/Utilities";
import { CommandContext } from "../../src/Commands/CommandFactory";

/**
 * Examples of using the GuildResourceLocator utility
 * Shows how to easily access guild channels, roles, and members
 */

// Example function showing how to use GuildResourceLocator
export async function ExampleGuildResourceUsage(guild: Guild, logger: Logger) {
  // Create a guild resource locator for easy access to guild resources
  const locator = CreateGuildResourceLocator({
    guild,
    logger,
    cacheTtlMs: 120_000, // Cache for 2 minutes
  });

  try {
    // Get channels by ID or name
    const channels = [
      await locator.GetChannelByName("general"),
      await locator.GetChannelByName("announcements"),
      await locator.GetChannelByName("bot-commands"),
    ].filter(Boolean);

    // Get roles by name
    const adminRole = await locator.GetRoleByName("admin");
    const moderatorRole = await locator.GetRoleByName("moderator");
    const memberRole = await locator.GetRoleByName("member");

    // Get members
    const botMember = await locator.GetMember(guild.client.user?.id);
    const ownerMember = await locator.GetMember(guild.ownerId);

    // Ensure resources exist (throws error if not found)
    const requiredChannel = await locator.EnsureTextChannel("general");
    const requiredRole = await locator.EnsureRole("admin");

    logger.Info("Guild resources gathered", {
      extra: {
        channelsFound: channels.length,
        rolesFound: [adminRole, moderatorRole, memberRole].filter(Boolean)
          .length,
        membersFound: [botMember, ownerMember].filter(Boolean).length,
        requiredChannel: requiredChannel?.name,
        requiredRole: requiredRole?.name,
      },
    });

    return {
      channels,
      roles: { adminRole, moderatorRole, memberRole },
      members: { botMember, ownerMember },
      required: { channel: requiredChannel, role: requiredRole },
    };
  } catch (error) {
    logger.Error("Failed to gather guild resources", {
      guildId: guild.id,
      error,
    });
    throw error;
  }
}

// Example of using the locator in a command context
export async function ExampleCommandUsage(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
) {
  if (!interaction.guild) {
    await context.responders.interactionResponder.Reply(interaction, {
      content: "❌ This command requires a guild context.",
      ephemeral: true,
    });
    return;
  }

  const locator = CreateGuildResourceLocator({
    guild: interaction.guild,
    logger: context.logger,
    cacheTtlMs: 60_000, // Cache for 1 minute
  });

  // Get current channel
  const currentChannel = await locator.GetTextChannel(interaction.channelId);

  // Get user's roles
  const member = await locator.GetMember(interaction.user.id);
  const userRoles = member?.roles.cache.map((role) => role.name) || [];

  // Create response
  const content = `📊 **Current Context**\n\n**Channel:** ${currentChannel?.name}\n**Your Roles:** ${userRoles.join(", ") || "None"}`;

  await context.responders.interactionResponder.Reply(interaction, {
    content,
    ephemeral: true,
  });
}

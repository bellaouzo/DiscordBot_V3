import type {
  ChatInputCommandInteraction,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import { ChannelType, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import type { LockdownScope } from "@database";
import {
  HandleLockCategory,
  HandleLockChannel,
} from "@commands/Moderation/Lockdown/ApplyFlow";
import {
  HandleLockdownStatus,
  HandleUnlockTarget,
} from "@commands/Moderation/Lockdown/LiftFlow";

async function ExecuteLockdown(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const sub = interaction.options.getSubcommand(true);

  if (sub === "channel") {
    const target = interaction.options.getChannel("target", true);
    if (
      target.type !== ChannelType.GuildText &&
      target.type !== ChannelType.GuildAnnouncement
    ) {
      const embed = EmbedFactory.CreateError({
        title: "Unsupported Channel",
        description: "Lockdown supports text or announcement channels.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await HandleLockChannel(interaction, context, target as TextChannel);
    return;
  }

  if (sub === "category") {
    const target = interaction.options.getChannel("target", true);
    if (target.type !== ChannelType.GuildCategory) {
      const embed = EmbedFactory.CreateError({
        title: "Unsupported Target",
        description: "Please select a category channel.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await HandleLockCategory(interaction, context, target as CategoryChannel);
    return;
  }

  if (sub === "unlock") {
    const target = interaction.options.getChannel("target", true);
    const scope: LockdownScope =
      target.type === ChannelType.GuildCategory ? "category" : "channel";
    await HandleUnlockTarget(interaction, context, scope, target.id);
    return;
  }

  if (sub === "status") {
    await HandleLockdownStatus(interaction, context);
    return;
  }
}

export const LockdownCommand = CreateCommand({
  name: "lockdown",
  description: "Lock or unlock channels and categories",
  group: "moderation",
  config: Config.mod().build(),
  execute: ExecuteLockdown,
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("channel")
          .setDescription("Lock a text or announcement channel")
          .addChannelOption((option) =>
            option
              .setName("target")
              .setDescription("Channel to lock")
              .setRequired(true)
              .addChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("category")
          .setDescription("Lock a category and its channels")
          .addChannelOption((option) =>
            option
              .setName("target")
              .setDescription("Category to lock")
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildCategory),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("unlock")
          .setDescription("Unlock a channel or category")
          .addChannelOption((option) =>
            option
              .setName("target")
              .setDescription("Channel or category to unlock")
              .setRequired(true)
              .addChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
                ChannelType.GuildCategory,
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("status").setDescription("View active lockdowns"),
      );
  },
});

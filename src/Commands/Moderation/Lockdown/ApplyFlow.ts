import type {
  ChatInputCommandInteraction,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { RequireGuild, EmbedFactory } from "@utilities";
import { SerializeOverwrites } from "@commands/Moderation/shared/OverwriteSerialization";

export async function HandleLockChannel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  channel: TextChannel,
): Promise<void> {
  const db = context.databases.moderationDb;
  const existing = db.GetActiveLockdown(
    "channel",
    RequireGuild(interaction).id,
    channel.id,
  );

  if (existing) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Locked",
      description: `Channel ${channel} is already locked.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const snapshot = SerializeOverwrites(
    channel.permissionOverwrites.cache.values(),
  );

  await channel.permissionOverwrites.edit(channel.guild.id, {
    SendMessages: false,
    SendMessagesInThreads: false,
    AddReactions: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
  });

  db.AddLockdown({
    scope: "channel",
    guild_id: channel.guild.id,
    target_id: channel.id,
    applied_by: interaction.user.id,
    overwrites: snapshot,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Channel Locked",
    description: `Locked ${channel} for everyone.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

export async function HandleLockCategory(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  category: CategoryChannel,
): Promise<void> {
  const db = context.databases.moderationDb;
  const existing = db.GetActiveLockdown(
    "category",
    RequireGuild(interaction).id,
    category.id,
  );

  if (existing) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Locked",
      description: `Category **${category.name}** is already locked.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const snapshot = SerializeOverwrites(
    category.permissionOverwrites.cache.values(),
  );

  await category.permissionOverwrites.edit(category.guild.id, {
    SendMessages: false,
    SendMessagesInThreads: false,
    AddReactions: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
  });

  db.AddLockdown({
    scope: "category",
    guild_id: category.guild.id,
    target_id: category.id,
    applied_by: interaction.user.id,
    overwrites: snapshot,
  });

  const embed = EmbedFactory.CreateSuccess({
    title: "Category Locked",
    description: `Locked category **${category.name}** and its channels.`,
  });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

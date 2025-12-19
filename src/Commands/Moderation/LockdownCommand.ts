import {
  ChatInputCommandInteraction,
  ChannelType,
  OverwriteType,
  TextChannel,
  CategoryChannel,
  OverwriteResolvable,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { LockdownScope } from "@database";

type StoredOverwrite = {
  id: string;
  allow: string;
  deny: string;
  type: OverwriteType;
};

function SerializeOverwrites(
  overwrites: Iterable<OverwriteResolvable>
): string {
  const serialized: StoredOverwrite[] = [];

  const toBigInt = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    const bitfield = (value as { bitfield?: unknown })?.bitfield;
    return typeof bitfield === "bigint" ? bitfield : 0n;
  };

  for (const overwrite of overwrites) {
    const data = overwrite as Partial<{
      id: string;
      allow: unknown;
      deny: unknown;
      type: OverwriteType;
    }>;

    if (typeof data.id !== "string") {
      continue;
    }

    serialized.push({
      id: data.id,
      allow: toBigInt(data.allow).toString(),
      deny: toBigInt(data.deny).toString(),
      type: data.type ?? OverwriteType.Role,
    });
  }

  return JSON.stringify(serialized);
}

function DeserializeOverwrites(serialized: string): OverwriteResolvable[] {
  const parsed = JSON.parse(serialized) as StoredOverwrite[];
  return parsed.map((entry) => ({
    id: entry.id,
    allow: BigInt(entry.allow),
    deny: BigInt(entry.deny),
    type: entry.type,
  }));
}

async function LockChannel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  channel: TextChannel
): Promise<void> {
  const db = context.databases.moderationDb;
  const existing = db.GetActiveLockdown(
    "channel",
    interaction.guild!.id,
    channel.id
  );

  if (existing) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Locked",
      description: `Channel ${channel} is already locked.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const snapshot = SerializeOverwrites(
    channel.permissionOverwrites.cache.values()
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
    ephemeral: true,
  });
}

async function LockCategory(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  category: CategoryChannel
): Promise<void> {
  const db = context.databases.moderationDb;
  const existing = db.GetActiveLockdown(
    "category",
    interaction.guild!.id,
    category.id
  );

  if (existing) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Locked",
      description: `Category **${category.name}** is already locked.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const snapshot = SerializeOverwrites(
    category.permissionOverwrites.cache.values()
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
    ephemeral: true,
  });
}

async function UnlockTarget(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  scope: LockdownScope,
  targetId: string
): Promise<void> {
  const db = context.databases.moderationDb;
  try {
    const record = db.GetActiveLockdown(scope, interaction.guild!.id, targetId);
    if (!record) {
      const embed = EmbedFactory.CreateWarning({
        title: "Not Locked",
        description: "No active lockdown found for the target.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const overwrites = DeserializeOverwrites(record.overwrites);
    const channel = interaction.guild!.channels.cache.get(targetId);

    if (!channel || !("permissionOverwrites" in channel)) {
      const embed = EmbedFactory.CreateError({
        title: "Channel Missing",
        description:
          "Could not locate the locked target to restore permissions.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    await (channel as TextChannel | CategoryChannel).permissionOverwrites.set(
      overwrites
    );

    db.MarkLockdownLifted(record.id);

    const embed = EmbedFactory.CreateSuccess({
      title: "Lockdown Cleared",
      description: `Restored permissions for ${channel}.`,
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to unlock target", { error });
  }
}

async function ShowStatus(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const db = context.databases.moderationDb;
  try {
    const active = db.ListActiveLockdowns(interaction.guild!.id);
    if (active.length === 0) {
      const embed = EmbedFactory.CreateWarning({
        title: "No Active Lockdowns",
        description: "There are no locked channels or categories.",
      });
      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const embed = EmbedFactory.Create({
      title: "🔒 Active Lockdowns",
      description: active
        .map((lock) => {
          const target =
            lock.scope === "category"
              ? `Category <#${lock.target_id}>`
              : `Channel <#${lock.target_id}>`;
          return `${target} — by <@${lock.applied_by}> <t:${Math.floor(
            lock.applied_at / 1000
          )}:R>`;
        })
        .join("\n"),
    });

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    context.logger.Error("Failed to show status", { error });
  }
}

async function ExecuteLockdown(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "This command can only be used in a server.",
    });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

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
        ephemeral: true,
      });
      return;
    }

    await LockChannel(interaction, context, target as TextChannel);
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
        ephemeral: true,
      });
      return;
    }

    await LockCategory(interaction, context, target as CategoryChannel);
    return;
  }

  if (sub === "unlock") {
    const target = interaction.options.getChannel("target", true);
    const scope: LockdownScope =
      target.type === ChannelType.GuildCategory ? "category" : "channel";
    await UnlockTarget(interaction, context, scope, target.id);
    return;
  }

  if (sub === "status") {
    await ShowStatus(interaction, context);
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
                ChannelType.GuildAnnouncement
              )
          )
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
              .addChannelTypes(ChannelType.GuildCategory)
          )
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
                ChannelType.GuildCategory
              )
          )
      )
      .addSubcommand((sub) =>
        sub.setName("status").setDescription("View active lockdowns")
      );
  },
});

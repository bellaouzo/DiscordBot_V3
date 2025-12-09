import {
  ChatInputCommandInteraction,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageActionRowComponent,
  NewsChannel,
  ThreadChannel,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import {
  LoggingMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
  PermissionMiddleware,
} from "@middleware";
import { EmbedFactory } from "@utilities";
import { GiveawayManager } from "./giveaway/GiveawayManager";
import { ParseDuration } from "@utilities/Duration";
import { Giveaway } from "@database";

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 10080; // 7 days
type GuildTextChannel = TextChannel | NewsChannel | ThreadChannel;

async function FinalizeGiveaway(
  manager: GiveawayManager,
  giveaway: Giveaway,
  channel?: GuildTextChannel
): Promise<{ winners: string[]; entryCount: number }> {
  return manager.FinalizeGiveaway(giveaway, channel);
}

async function ExecuteGiveaway(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case "create":
      await HandleCreate(interaction, context);
      break;
    case "end":
      await HandleEnd(interaction, context);
      break;
    case "reroll":
      await HandleReroll(interaction, context);
      break;
    case "list":
      await HandleList(interaction, context);
      break;
  }
}

async function HandleCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, componentRouter } = context.responders;

  if (!interaction.guildId || !interaction.channel?.isTextBased()) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Giveaways can only be created in server text channels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const prize = interaction.options.getString("prize", true);
  const durationStr = interaction.options.getString("duration", true);
  const winnerCount = interaction.options.getInteger("winners") ?? 1;

  const durationMs = ParseDuration(durationStr);
  const durationMinutes = durationMs ? durationMs / 60000 : null;

  if (
    !durationMinutes ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Duration",
      description: `Duration must be between 1 minute and 7 days. Examples: \`30m\`, \`2h\`, \`1d\``,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  await interactionResponder.Defer(interaction, true);

  const manager = new GiveawayManager(
    interaction.guildId,
    context.databases.userDb
  );
  const endsAt = Date.now() + durationMs!;

  const { embed, row, customId } = manager.CreateGiveawayMessage({
    prize,
    endsAt,
    winnerCount,
    hostId: interaction.user.id,
    entryCount: 0,
  });

  const channel = interaction.channel as GuildTextChannel;
  const giveawayMessage = await channel.send({
    embeds: [embed.toJSON()],
    components: [row],
  });

  manager.SaveGiveaway({
    channelId: channel.id,
    messageId: giveawayMessage.id,
    hostId: interaction.user.id,
    prize,
    winnerCount,
    endsAt,
  });

  componentRouter.RegisterButton({
    customId: customId,
    expiresInMs: endsAt - Date.now() + 60000,
    handler: async (buttonInteraction) => {
      const giveawayData = manager.GetGiveaway(giveawayMessage.id);

      if (!giveawayData || giveawayData.ended) {
        const endedEmbed = EmbedFactory.CreateWarning({
          title: "Giveaway Ended",
          description: "This giveaway has already ended.",
        });
        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [endedEmbed.toJSON()],
          ephemeral: true,
        });
        return;
      }

      if (giveawayData.ends_at <= Date.now()) {
        const { winners, entryCount } = await FinalizeGiveaway(
          manager,
          giveawayData,
          channel
        );
        const winnerMentions =
          winners.length > 0
            ? winners.map((id) => `<@${id}>`).join(", ")
            : "No winners";
        const endedEmbed = EmbedFactory.CreateWarning({
          title: "Giveaway Ended",
          description: [
            `**Prize:** ${giveawayData.prize}`,
            `**Winners:** ${winnerMentions}`,
            `**Total Entries:** ${entryCount}`,
          ].join("\n"),
        });

        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [endedEmbed.toJSON()],
          ephemeral: true,
        });
        return;
      }

      const hasEntered = manager.HasEntered(
        giveawayData.id,
        buttonInteraction.user.id
      );

      if (hasEntered) {
        manager.LeaveGiveaway(giveawayData.id, buttonInteraction.user.id);
        const newCount = manager.GetEntryCount(giveawayData.id);

        const leftEmbed = EmbedFactory.CreateWarning({
          title: "Left Giveaway",
          description: `You have left the giveaway for **${giveawayData.prize}**.`,
        });

        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [leftEmbed.toJSON()],
          ephemeral: true,
        });

        await UpdateEntryCount(
          channel,
          giveawayMessage.id,
          manager,
          giveawayData,
          newCount,
          false
        );
      } else {
        manager.EnterGiveaway(giveawayData.id, buttonInteraction.user.id);
        const newCount = manager.GetEntryCount(giveawayData.id);

        const enteredEmbed = EmbedFactory.CreateSuccess({
          title: "Entered Giveaway",
          description: `🎉 You have entered the giveaway for **${giveawayData.prize}**! Click again to leave.`,
        });

        await context.responders.buttonResponder.Reply(buttonInteraction, {
          embeds: [enteredEmbed.toJSON()],
          ephemeral: true,
        });

        await UpdateEntryCount(
          channel,
          giveawayMessage.id,
          manager,
          giveawayData,
          newCount,
          true
        );
      }
    },
  });

  const confirmEmbed = EmbedFactory.CreateSuccess({
    title: "Giveaway Created",
    description: [
      `**Prize:** ${prize}`,
      `**Winners:** ${winnerCount}`,
      `**Duration:** ${durationStr}`,
      `**Ends:** <t:${Math.floor(endsAt / 1000)}:R>`,
      ``,
      `[Jump to Giveaway](${giveawayMessage.url})`,
    ].join("\n"),
  });

  await interactionResponder.Edit(interaction, {
    embeds: [confirmEmbed.toJSON()],
  });
}

async function UpdateEntryCount(
  channel: GuildTextChannel,
  messageId: string,
  manager: GiveawayManager,
  giveaway: {
    prize: string;
    ends_at: number;
    winner_count: number;
    host_id: string;
  },
  entryCount: number,
  userHasEntered: boolean
): Promise<void> {
  try {
    const message = await channel.messages.fetch(messageId);
    const { embed } = manager.CreateGiveawayMessage({
      prize: giveaway.prize,
      endsAt: giveaway.ends_at,
      winnerCount: giveaway.winner_count,
      hostId: giveaway.host_id,
      entryCount,
    });

    const firstRow = message.components[0];
    const existingCustomId =
      firstRow && "components" in firstRow
        ? (firstRow.components[0] as MessageActionRowComponent)?.customId
        : undefined;

    if (existingCustomId) {
      const button = new ButtonBuilder()
        .setCustomId(existingCustomId)
        .setLabel(userHasEntered ? "🚪 Leave Giveaway" : "🎉 Enter Giveaway")
        .setStyle(userHasEntered ? ButtonStyle.Secondary : ButtonStyle.Primary);
      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        button
      );

      await message.edit({
        embeds: [embed.toJSON()],
        components: [newRow],
      });
    }
  } catch {
    // Message may have been deleted
  }
}

async function HandleEnd(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guildId) {
    const embed = EmbedFactory.CreateError({
      title: "Server Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const messageId = interaction.options.getString("message_id", true);
  const manager = new GiveawayManager(
    interaction.guildId,
    context.databases.userDb
  );
  const giveaway = manager.GetGiveaway(messageId);

  if (!giveaway) {
    const embed = EmbedFactory.CreateError({
      title: "Giveaway Not Found",
      description: "No giveaway found with that message ID.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (giveaway.ended) {
    const embed = EmbedFactory.CreateWarning({
      title: "Already Ended",
      description: "This giveaway has already ended.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  await interactionResponder.Defer(interaction, true);

  const channel = await interaction.guild?.channels.fetch(giveaway.channel_id);
  const guildChannel =
    channel && channel.isTextBased()
      ? (channel as GuildTextChannel)
      : undefined;

  const { winners, entryCount } = await FinalizeGiveaway(
    manager,
    giveaway,
    guildChannel
  );

  const winnerMentions =
    winners.length > 0
      ? winners.map((id) => `<@${id}>`).join(", ")
      : "No winners";
  const embed = EmbedFactory.CreateSuccess({
    title: "Giveaway Ended",
    description: [
      `**Prize:** ${giveaway.prize}`,
      `**Winners:** ${winnerMentions}`,
      `**Total Entries:** ${entryCount}`,
    ].join("\n"),
  });

  await interactionResponder.Edit(interaction, {
    embeds: [embed.toJSON()],
  });
}

async function HandleReroll(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guildId) {
    const embed = EmbedFactory.CreateError({
      title: "Server Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const messageId = interaction.options.getString("message_id", true);
  const manager = new GiveawayManager(
    interaction.guildId,
    context.databases.userDb
  );
  const giveaway = manager.GetGiveaway(messageId);

  if (!giveaway) {
    const embed = EmbedFactory.CreateError({
      title: "Giveaway Not Found",
      description: "No giveaway found with that message ID.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (!giveaway.ended) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Ended",
      description: "This giveaway hasn't ended yet. Use `/giveaway end` first.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const newWinners = manager.SelectWinners(giveaway.id, giveaway.winner_count);
  manager.EndGiveaway(messageId, newWinners);

  try {
    const channel = await interaction.guild?.channels.fetch(
      giveaway.channel_id
    );
    if (channel instanceof TextChannel) {
      const mentions =
        newWinners.length > 0
          ? newWinners.map((id) => `<@${id}>`).join(", ")
          : "No valid entries";

      await channel.send({
        content: `🔄 Giveaway rerolled! New winner${newWinners.length !== 1 ? "s" : ""}: ${mentions} for **${giveaway.prize}**!`,
      });
    }
  } catch {
    // Channel may not exist
  }

  const winnerMentions =
    newWinners.length > 0
      ? newWinners.map((id) => `<@${id}>`).join(", ")
      : "No winners";
  const embed = EmbedFactory.CreateSuccess({
    title: "Giveaway Rerolled",
    description: [
      `**Prize:** ${giveaway.prize}`,
      `**New Winners:** ${winnerMentions}`,
    ].join("\n"),
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guildId) {
    const embed = EmbedFactory.CreateError({
      title: "Server Only",
      description: "This command can only be used in a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const manager = new GiveawayManager(
    interaction.guildId,
    context.databases.userDb
  );
  const activeGiveaways = manager.GetActiveGiveaways();

  if (activeGiveaways.length === 0) {
    const embed = EmbedFactory.CreateWarning({
      title: "No Active Giveaways",
      description: "There are no active giveaways in this server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const lines = activeGiveaways.map((g, i) => {
    const endsAt = Math.floor(g.ends_at / 1000);
    const entries = manager.GetEntryCount(g.id);
    return `**${i + 1}.** ${g.prize}\n   Ends <t:${endsAt}:R> • ${entries} entries • ID: \`${g.message_id}\``;
  });

  const embed = EmbedFactory.Create({
    title: "🎉 Active Giveaways",
    description: lines.join("\n\n"),
    footer: `${activeGiveaways.length} active giveaway${activeGiveaways.length !== 1 ? "s" : ""}`,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

export const GiveawayCommand = CreateCommand({
  name: "giveaway",
  description: "Create and manage giveaways",
  group: "utility",
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new giveaway")
          .addStringOption((opt) =>
            opt
              .setName("prize")
              .setDescription("What you're giving away")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("duration")
              .setDescription("How long the giveaway lasts (e.g., 30m, 2h, 1d)")
              .setRequired(true)
          )
          .addIntegerOption((opt) =>
            opt
              .setName("winners")
              .setDescription("Number of winners (default: 1)")
              .setMinValue(1)
              .setMaxValue(10)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("end")
          .setDescription("End a giveaway early")
          .addStringOption((opt) =>
            opt
              .setName("message_id")
              .setDescription("Message ID of the giveaway")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("reroll")
          .setDescription("Reroll winners for an ended giveaway")
          .addStringOption((opt) =>
            opt
              .setName("message_id")
              .setDescription("Message ID of the giveaway")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List all active giveaways")
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: {
    permissions: {
      required: ["ManageMessages"],
      requireAny: false,
    },
    cooldown: { seconds: 5 },
  },
  execute: ExecuteGiveaway,
});

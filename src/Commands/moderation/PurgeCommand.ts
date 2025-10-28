import { ChatInputCommandInteraction, TextChannel, Message } from "discord.js";
import { CommandContext, CreateCommand } from "../CommandFactory";
import {
  LoggingMiddleware,
  PermissionMiddleware,
  CooldownMiddleware,
  ErrorMiddleware,
} from "../Middleware";
import { Config } from "../Middleware/CommandConfig";
import { EmbedFactory } from "../../Utilities/EmbedBuilder";

function ValidatePurgeOptions(
  amount: number,
  before?: number,
  after?: number
): void {
  if (amount < 1 || amount > 100) {
    throw new Error("Amount must be between 1 and 100 messages.");
  }

  if (before !== undefined && after !== undefined) {
    throw new Error("Cannot use both before and after filters simultaneously.");
  }

  if (before !== undefined && before < 0) {
    throw new Error("Before filter must be a non-negative number.");
  }

  if (after !== undefined && after < 0) {
    throw new Error("After filter must be a non-negative number.");
  }
}

async function FetchMessagesToDelete(
  channel: TextChannel,
  amount: number,
  userId?: string,
  beforeHours?: number,
  afterHours?: number
): Promise<{ messages: Message[]; totalFetched: number }> {
  const now = Date.now();
  const messagesToDelete: Message[] = [];
  const maxFetchLimit = 100;

  const fetchCount = Math.min(amount * 3, maxFetchLimit);
  const fetchedMessages = await channel.messages.fetch({ limit: fetchCount });
  const totalFetched = fetchedMessages.size;

  for (const message of fetchedMessages.values()) {
    if (messagesToDelete.length >= amount) break;

    const messageAge = now - message.createdTimestamp;
    const messageAgeHours = messageAge / (1000 * 60 * 60);

    if (beforeHours !== undefined && messageAgeHours < beforeHours) {
      continue;
    }

    if (afterHours !== undefined && messageAgeHours > afterHours) {
      continue;
    }

    if (userId && message.author.id !== userId) {
      continue;
    }

    messagesToDelete.push(message);
  }

  return { messages: messagesToDelete, totalFetched };
}

async function ExecutePurge(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { actionResponder } = context.responders;
  const { logger } = context;

  if (!interaction.channel?.isTextBased()) {
    throw new Error("This command can only be used in text channels.");
  }

  const amount = interaction.options.getInteger("amount", true);
  const targetUser = interaction.options.getUser("user");
  const beforeHours = interaction.options.getInteger("before");
  const afterHours = interaction.options.getInteger("after");

  ValidatePurgeOptions(
    amount,
    beforeHours ?? undefined,
    afterHours ?? undefined
  );

  const channel = interaction.channel as TextChannel;

  let deletedCount = 0;
  let tooOldCount = 0;

  await actionResponder.Send({
    interaction,
    message: {
      embeds: [
        EmbedFactory.Create({
          title: "🗑️ Purging Messages",
          description: "Fetching and deleting messages...",
          color: 0x5865f2,
        }),
      ],
    },
    action: async () => {
      logger.Info("Fetching messages to purge", {
        extra: {
          channelId: channel.id,
          amount,
          userId: targetUser?.id,
          beforeHours,
          afterHours,
        },
      });

      const { messages } = await FetchMessagesToDelete(
        channel,
        amount,
        targetUser?.id,
        beforeHours ?? undefined,
        afterHours ?? undefined
      );

      if (messages.length === 0) {
        throw new Error("No messages found matching the specified criteria.");
      }

      logger.Info("Found messages to delete", {
        extra: {
          count: messages.length,
        },
      });

      const messagesToDelete = messages.filter((msg) => {
        const age = Date.now() - msg.createdTimestamp;
        const ageInDays = age / (1000 * 60 * 60 * 24);
        return ageInDays < 14;
      });

      if (messagesToDelete.length === 0) {
        throw new Error(
          "All matching messages are older than 14 days and cannot be bulk deleted. (Discord limitation)"
        );
      }

      tooOldCount = messages.length - messagesToDelete.length;

      await channel.bulkDelete(messagesToDelete, true);

      deletedCount = messagesToDelete.length;

      logger.Info("Messages purged", {
        extra: {
          deleted: deletedCount,
          tooOld: tooOldCount,
        },
      });

      const embed = EmbedFactory.CreateSuccess({
        title: "✅ Messages Purged",
        description: `Successfully deleted ${deletedCount} message${
          deletedCount !== 1 ? "s" : ""
        }.`,
      });

      embed.addFields([
        {
          name: "Messages Deleted",
          value: `${deletedCount} message${deletedCount !== 1 ? "s" : ""}`,
          inline: true,
        },
      ]);

      if (tooOldCount > 0) {
        embed.addFields([
          {
            name: "Note",
            value: `${tooOldCount} message${
              tooOldCount !== 1 ? "s" : ""
            } could not be deleted (older than 14 days)`,
            inline: false,
          },
        ]);
      }

      if (targetUser) {
        embed.addFields([
          {
            name: "Filter Applied",
            value: `User: ${targetUser.username}`,
            inline: true,
          },
        ]);
      }

      if (beforeHours !== null) {
        embed.addFields([
          {
            name: "Time Filter",
            value: `Older than ${beforeHours} hours`,
            inline: true,
          },
        ]);
      }

      if (afterHours !== null) {
        embed.addFields([
          {
            name: "Time Filter",
            value: `Newer than ${afterHours} hours`,
            inline: true,
          },
        ]);
      }

      await interaction.followUp({ embeds: [embed] });
    },
  });
}

export const PurgeCommand = CreateCommand({
  name: "purge",
  description: "Delete messages in bulk with optional filters",
  group: "moderation",
  configure: (builder) => {
    builder
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("Number of messages to delete (1-100)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Only delete messages from this user")
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("before")
          .setDescription("Only delete messages older than N hours")
          .setRequired(false)
          .setMinValue(0)
      )
      .addIntegerOption((option) =>
        option
          .setName("after")
          .setDescription("Only delete messages newer than N hours")
          .setRequired(false)
          .setMinValue(0)
      );
  },
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware, CooldownMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.create()
    .permissions("ManageMessages")
    .cooldownSeconds(10)
    .build(),
  execute: ExecutePurge,
});

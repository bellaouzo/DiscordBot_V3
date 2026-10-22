import type {
  ChatInputCommandInteraction,
  TextChannel,
  Message,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import { ButtonStyle, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand, CreateMessageMenu } from "@commands";
import { ComponentFactory, EmbedFactory } from "@utilities";
import { ToActionRowData } from "@utilities/ComponentBuilder";

const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PURGE_CONFIRM_TIMEOUT_MS = 60 * 1000;

function ValidatePurgeOptions(
  amount: number,
  before?: number,
  after?: number,
): string | null {
  if (amount < 1 || amount > 100) {
    return "Amount must be between 1 and 100 messages.";
  }

  if (before !== undefined && after !== undefined) {
    return "Cannot use both before and after filters simultaneously.";
  }

  if (before !== undefined && before < 0) {
    return "Before filter must be a non-negative number.";
  }

  if (after !== undefined && after < 0) {
    return "After filter must be a non-negative number.";
  }

  return null;
}

async function FetchMessagesToDelete(
  channel: TextChannel,
  amount: number,
  userId?: string,
  beforeHours?: number,
  afterHours?: number,
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
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.channel?.isTextBased()) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "This command can only be used in text channels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const amount = interaction.options.getInteger("amount", true);
  const targetUser = interaction.options.getUser("user");
  const beforeHours = interaction.options.getInteger("before");
  const afterHours = interaction.options.getInteger("after");

  const validationError = ValidatePurgeOptions(
    amount,
    beforeHours ?? undefined,
    afterHours ?? undefined,
  );

  if (validationError) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Options",
      description: validationError,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;

  let deletedCount = 0;
  let tooOldCount = 0;

  await interactionResponder.WithAction({
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
      const { messages } = await FetchMessagesToDelete(
        channel,
        amount,
        targetUser?.id,
        beforeHours ?? undefined,
        afterHours ?? undefined,
      );

      if (messages.length === 0) {
        throw new Error("No messages found matching the specified criteria.");
      }

      const messagesToDelete = messages.filter((msg) => {
        const age = Date.now() - msg.createdTimestamp;
        const ageInDays = age / (1000 * 60 * 60 * 24);
        return ageInDays < 14;
      });

      if (messagesToDelete.length === 0) {
        throw new Error(
          "All matching messages are older than 14 days and cannot be bulk deleted. (Discord limitation)",
        );
      }

      tooOldCount = messages.length - messagesToDelete.length;

      await channel.bulkDelete(messagesToDelete, true);

      deletedCount = messagesToDelete.length;

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

      await interactionResponder.FollowUp(interaction, { embeds: [embed] });
    },
  });
}

export const PurgeCommand = CreateCommand({
  name: "purge",
  description: "Delete messages in bulk with optional filters",
  group: "moderation",
  config: {
    access: "mod",
    cooldown: "5s",
    botPermissions: ["ManageMessages", "ReadMessageHistory"],
  },
  execute: ExecutePurge,
  configure: (builder) => {
    builder
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("Number of messages to delete (1-100)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Only delete messages from this user")
          .setRequired(false),
      )
      .addIntegerOption((option) =>
        option
          .setName("before")
          .setDescription("Only delete messages older than N hours")
          .setRequired(false)
          .setMinValue(0),
      )
      .addIntegerOption((option) =>
        option
          .setName("after")
          .setDescription("Only delete messages newer than N hours")
          .setRequired(false)
          .setMinValue(0),
      );
  },
});

/**
 * The clicked message and everything after it, from the channel's latest 100 messages.
 * Returns null when the message is further back than that.
 */
async function CollectMessagesFrom(
  channel: TextChannel,
  target: Message,
): Promise<Message[] | null> {
  const recent = await channel.messages.fetch({ limit: 100 });
  if (!recent.has(target.id)) {
    return null;
  }
  const targetId = BigInt(target.id);
  return [...recent.values()].filter(
    (message) => BigInt(message.id) >= targetId,
  );
}

async function ExecutePurgeFromHere(
  interaction: MessageContextMenuCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, componentRouter } = context.responders;
  const channel = interaction.channel;

  const replyError = (title: string, description: string) =>
    interactionResponder.Reply(interaction, {
      embeds: [EmbedFactory.CreateError({ title, description }).toJSON()],
      flags: MessageFlags.Ephemeral,
    });

  if (!channel?.isTextBased() || channel.isDMBased()) {
    await replyError(
      "Invalid Channel",
      "This only works in server text channels.",
    );
    return;
  }

  const messages = await CollectMessagesFrom(
    channel as TextChannel,
    interaction.targetMessage,
  );
  if (!messages) {
    await replyError(
      "Too Far Back",
      "That message is more than 100 messages ago. Use `/purge` instead.",
    );
    return;
  }

  const deletable = messages.filter(
    (message) => Date.now() - message.createdTimestamp < BULK_DELETE_MAX_AGE_MS,
  );
  if (deletable.length === 0) {
    await replyError(
      "Nothing To Delete",
      "Those messages are older than 14 days, which Discord doesn't allow bulk deleting.",
    );
    return;
  }

  const plural = deletable.length !== 1 ? "s" : "";
  const confirm = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: PURGE_CONFIRM_TIMEOUT_MS,
    singleUse: true,
    handler: async (button) => {
      const deleted = await (channel as TextChannel).bulkDelete(
        deletable,
        true,
      );
      await button.update({
        embeds: [
          EmbedFactory.CreateSuccess({
            title: "✅ Messages Purged",
            description: `Deleted ${deleted.size} message${deleted.size !== 1 ? "s" : ""}.`,
          }).toJSON(),
        ],
        components: [],
      });
    },
  });
  const cancel = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: PURGE_CONFIRM_TIMEOUT_MS,
    singleUse: true,
    handler: async (button) => {
      await button.update({
        embeds: [
          EmbedFactory.Create({
            title: "Purge Cancelled",
            description: "No messages were deleted.",
          }).toJSON(),
        ],
        components: [],
      });
    },
  });

  const skipped = messages.length - deletable.length;
  await interactionResponder.Reply(interaction, {
    embeds: [
      EmbedFactory.CreateWarning({
        title: "🗑️ Purge From Here?",
        description: `This deletes the selected message and everything after it: **${deletable.length} message${plural}**.${
          skipped > 0 ? `\n${skipped} older than 14 days will be skipped.` : ""
        }`,
      }).toJSON(),
    ],
    components: [
      ToActionRowData(
        ComponentFactory.CreateActionRow({
          buttons: [
            { label: `Delete ${deletable.length}`, style: ButtonStyle.Danger },
            { label: "Cancel", style: ButtonStyle.Secondary },
          ],
          customIds: [confirm.customId, cancel.customId],
        }),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

/** Right-click a message → Apps → Purge From Here: deletes it and everything after it. */
export const PurgeMessageMenu = CreateMessageMenu({
  name: "Purge From Here",
  command: PurgeCommand,
  execute: ExecutePurgeFromHere,
});

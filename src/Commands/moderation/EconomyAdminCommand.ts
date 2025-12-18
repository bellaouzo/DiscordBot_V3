import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { EconomyManager } from "@commands/fun/economy/EconomyManager";
import { ITEM_MAP } from "@commands/fun/economy/items";

function RequireGuild(
  interaction: ChatInputCommandInteraction
): asserts interaction is ChatInputCommandInteraction & { guildId: string } {
  if (!interaction.guild) {
    throw new Error("This command can only be used in a server.");
  }
}

function RequirePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be greater than 0.`);
  }
}

function BuildBalanceEmbed(options: {
  title: string;
  userId: string;
  before: number;
  after: number;
  note?: string;
}) {
  const embed = EmbedFactory.CreateSuccess({
    title: options.title,
    description: `User: <@${options.userId}>`,
  });

  embed.addFields(
    { name: "Previous Balance", value: `${options.before}`, inline: true },
    { name: "New Balance", value: `${options.after}`, inline: true }
  );

  if (options.note) {
    embed.addFields({ name: "Note", value: options.note, inline: false });
  }

  return embed;
}

function BuildItemEmbed(options: {
  title: string;
  userId: string;
  itemId: string;
  delta: number;
  quantity: number;
}) {
  const item = ITEM_MAP[options.itemId];
  const embed = EmbedFactory.CreateSuccess({
    title: options.title,
    description: `User: <@${options.userId}>`,
    footer: `Item: ${item?.name ?? options.itemId}`,
  });

  embed.addFields(
    { name: "Item ID", value: options.itemId, inline: true },
    {
      name: "Change",
      value: `${options.delta > 0 ? "+" : ""}${options.delta}`,
      inline: true,
    },
    { name: "New Quantity", value: `${options.quantity}`, inline: true }
  );

  return embed;
}

async function ExecuteEconomyAdmin(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  RequireGuild(interaction);

  const targetUser = interaction.options.getUser("user", true);
  const subcommand = interaction.options.getSubcommand();

  const manager = new EconomyManager(
    interaction.guildId,
    context.databases.userDb
  );
  if (subcommand === "setbalance") {
    const amount = interaction.options.getInteger("amount", true);
    if (amount < 0) {
      throw new Error("Amount must be 0 or higher.");
    }

    const before = manager.GetBalance(targetUser.id);
    const delta = amount - before;
    const after = manager.AdjustBalance(targetUser.id, delta, 0);

    const embed = BuildBalanceEmbed({
      title: "Balance Set",
      userId: targetUser.id,
      before,
      after,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "addbalance") {
    const amount = interaction.options.getInteger("amount", true);
    RequirePositive("Amount", amount);

    const before = manager.GetBalance(targetUser.id);
    const after = manager.AdjustBalance(targetUser.id, amount, 0);

    const embed = BuildBalanceEmbed({
      title: "Balance Added",
      userId: targetUser.id,
      before,
      after,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "removebalance") {
    const amount = interaction.options.getInteger("amount", true);
    RequirePositive("Amount", amount);

    const before = manager.GetBalance(targetUser.id);
    const after = manager.AdjustBalance(targetUser.id, -amount, 0);
    const removed = before - after;
    const note =
      removed < amount
        ? `Requested to remove ${amount}, but balance was clamped at 0. Removed ${removed}.`
        : undefined;

    const embed = BuildBalanceEmbed({
      title: "Balance Removed",
      userId: targetUser.id,
      before,
      after,
      note,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "giveitem" || subcommand === "takeitem") {
    const itemId = interaction.options.getString("item_id", true);
    const quantity = interaction.options.getInteger("quantity", true);
    RequirePositive("Quantity", quantity);

    const item = ITEM_MAP[itemId];
    if (!item) {
      throw new Error("Invalid item id.");
    }

    const delta = subcommand === "giveitem" ? quantity : -quantity;
    const entry = manager.AdjustInventoryItem({
      userId: targetUser.id,
      itemId,
      delta,
    });

    const embed = BuildItemEmbed({
      title: subcommand === "giveitem" ? "Item Granted" : "Item Removed",
      userId: targetUser.id,
      itemId,
      delta,
      quantity: entry.quantity,
    });

    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  throw new Error("Unsupported subcommand.");
}

export const EconomyAdminCommand = CreateCommand({
  name: "economyadmin",
  description: "Administer user balances and items",
  group: "moderation",
  config: Config.mod().build(),
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("setbalance")
          .setDescription("Set a user's balance to a specific amount")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Target user")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Balance to set (0 or higher)")
              .setRequired(true)
              .setMinValue(0)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("addbalance")
          .setDescription("Add coins to a user's balance")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Target user")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Amount to add (positive)")
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("removebalance")
          .setDescription("Remove coins from a user's balance")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Target user")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Amount to remove (positive)")
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("giveitem")
          .setDescription("Grant an economy item to a user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Target user")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("item_id")
              .setDescription("Item ID to grant")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("quantity")
              .setDescription("Quantity to grant")
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("takeitem")
          .setDescription("Remove an economy item from a user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Target user")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("item_id")
              .setDescription("Item ID to remove")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("quantity")
              .setDescription("Quantity to remove")
              .setRequired(true)
              .setMinValue(1)
          )
      );
  },
  execute: ExecuteEconomyAdmin,
});

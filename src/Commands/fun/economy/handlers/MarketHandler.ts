import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { MarketManager } from "../MarketManager";
import { EconomyManager } from "../EconomyManager";
import { ITEM_MAP } from "../items";
import { Paginator, type PaginationPage } from "@shared/Paginator";
import { EmbedFactory } from "@utilities";
import {
  BuildInventoryEmbed,
  BuildMarketActionSuccessEmbed,
  BuildMarketErrorEmbed,
} from "../utils/Embeds";

function buildMarketPages(
  offers: ReturnType<MarketManager["GetOffers"]>
): PaginationPage[] {
  if (offers.length === 0) {
    return [
      {
        embeds: [
          EmbedFactory.Create({
            title: "🛒 Market",
            description: "No items are available in this rotation.",
          }).toJSON(),
        ],
      },
    ];
  }

  const pageSize = 3;
  const pages: PaginationPage[] = [];
  const rotation = offers[0].rotationExpiresAt;

  for (let i = 0; i < offers.length; i += pageSize) {
    const slice = offers.slice(i, i + pageSize);
    const embed = EmbedFactory.Create({
      title: "🛒 Market",
      description: `Rotation ends <t:${Math.floor(rotation / 1000)}:R>. Use /economy market buy to purchase.`,
    });

    embed.addFields(
      slice.map((offer) => ({
        name: `${offer.item.name} — ${offer.item.price}c (sell ${offer.item.sellPrice}) [${offer.item.rarity.toUpperCase()}]`,
        value: offer.item.description,
      }))
    );

    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

export async function HandleMarketView(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const manager = new MarketManager(interaction.guildId!, context.logger);

  try {
    const offers = manager.GetOffers();
    const pages = buildMarketPages(offers);
    const paginator = new Paginator({
      interaction,
      pages,
      interactionResponder: context.responders.interactionResponder,
      buttonResponder: context.responders.buttonResponder,
      componentRouter: context.responders.componentRouter,
      logger: context.logger,
      ephemeral: true,
      ownerId: interaction.user.id,
    });
    await paginator.Start();
  } finally {
    manager.Close();
  }
}

export async function HandleMarketRefresh(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const manager = new MarketManager(interaction.guildId!, context.logger);

  try {
    const offers = manager.RefreshOffers();
    const pages = buildMarketPages(offers);
    const paginator = new Paginator({
      interaction,
      pages,
      interactionResponder: context.responders.interactionResponder,
      buttonResponder: context.responders.buttonResponder,
      componentRouter: context.responders.componentRouter,
      logger: context.logger,
      ephemeral: true,
      ownerId: interaction.user.id,
    });
    await paginator.Start();
  } finally {
    manager.Close();
  }
}

export async function HandleMarketBuy(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const itemId = interaction.options.getString("item", true);
  const quantity = interaction.options.getInteger("quantity") ?? 1;

  const manager = new MarketManager(interaction.guildId!, context.logger);

  try {
    const { balance, inventory } = manager.BuyItem({
      userId: interaction.user.id,
      itemId,
      quantity,
    });

    const item = ITEM_MAP[itemId];
    const itemName = item ? item.name : itemId;
    const embed = BuildMarketActionSuccessEmbed({
      action: "buy",
      itemName,
      quantity,
      balance,
      newQuantity: inventory.quantity,
    });

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to buy item.";
    const embed = BuildMarketErrorEmbed({ message });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    manager.Close();
  }
}

export async function HandleMarketSell(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const itemId = interaction.options.getString("item", true);
  const quantity = interaction.options.getInteger("quantity") ?? 1;

  const manager = new MarketManager(interaction.guildId!, context.logger);

  try {
    const { balance, inventory } = manager.SellItem({
      userId: interaction.user.id,
      itemId,
      quantity,
    });

    const item = ITEM_MAP[itemId];
    const itemName = item ? item.name : itemId;
    const embed = BuildMarketActionSuccessEmbed({
      action: "sell",
      itemName,
      quantity,
      balance,
      newQuantity: inventory.quantity,
    });

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sell item.";
    const embed = BuildMarketErrorEmbed({ message });
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    manager.Close();
  }
}

export async function HandleInventory(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const manager = new EconomyManager(interaction.guildId!, context.logger);

  try {
    const entries = manager.GetInventory(interaction.user.id);
    const embed = BuildInventoryEmbed({ entries });

    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  } finally {
    manager.Close();
  }
}

import { EmbedFactory } from "@utilities";
import { InventoryEntry, MarketOffer } from "../../types";
import { ITEM_MAP } from "../../items";

export function BuildMarketEmbed(options: {
  offers: MarketOffer[];
}): ReturnType<typeof EmbedFactory.Create> {
  if (options.offers.length === 0) {
    return EmbedFactory.Create({
      title: "🛒 Market",
      description: "No items are available in this rotation.",
    });
  }

  const lines = options.offers.map((offer) => {
    const rarity = offer.item.rarity.toUpperCase();
    const effect = offer.item.effect ? ` • Effect: ${offer.item.effect}` : "";
    return `${offer.item.name} — **${offer.item.price}** coins (sell ${offer.item.sellPrice}) [${rarity}]${effect}`;
  });

  lines.push(
    `Rotation ends <t:${Math.floor(
      options.offers[0].rotationExpiresAt / 1000,
    )}:R>.`,
  );

  return EmbedFactory.Create({
    title: "🛒 Market",
    description: lines.join("\n"),
  });
}

export function BuildInventoryEmbed(options: {
  entries: InventoryEntry[];
}): ReturnType<typeof EmbedFactory.Create> {
  if (options.entries.length === 0) {
    return EmbedFactory.Create({
      title: "🎒 Inventory",
      description: "Your inventory is empty.",
    });
  }

  const lines = options.entries.map((entry) => {
    const item = ITEM_MAP[entry.itemId];
    const name = item ? item.name : entry.itemId;
    const rarity = item ? ` [${item.rarity.toUpperCase()}]` : "";
    return `${name}${rarity}: **${entry.quantity}**`;
  });

  return EmbedFactory.Create({
    title: "🎒 Inventory",
    description: lines.join("\n"),
  });
}

export function BuildMarketActionSuccessEmbed(options: {
  action: "buy" | "sell";
  itemName: string;
  quantity: number;
  balance: number;
  newQuantity: number;
}): ReturnType<typeof EmbedFactory.CreateSuccess> {
  const verb = options.action === "buy" ? "purchased" : "sold";
  return EmbedFactory.CreateSuccess({
    title: `✅ Market ${options.action === "buy" ? "Buy" : "Sell"}`,
    description: `You ${verb} **${options.quantity}x ${options.itemName}**.\nInventory: **${options.newQuantity}**\nBalance: **${options.balance}**`,
  });
}

export function BuildMarketErrorEmbed(options: {
  message: string;
}): ReturnType<typeof EmbedFactory.CreateWarning> {
  return EmbedFactory.CreateWarning({
    title: "Market Error",
    description: options.message,
  });
}

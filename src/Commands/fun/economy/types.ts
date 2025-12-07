import { ButtonStyle } from "discord.js";

export type AllowedButtonStyle =
  | ButtonStyle.Primary
  | ButtonStyle.Secondary
  | ButtonStyle.Success
  | ButtonStyle.Danger
  | ButtonStyle.Premium;

export type FlipChoice = "heads" | "tails";
export type RpsChoice = "rock" | "paper" | "scissors";
export type HorseId = 0 | 1 | 2 | 3;
export type ScratchSymbol = "💰" | "⭐" | "🍀" | "🍒";
export type CardValue =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type EconomyHandler = (
  interaction: import("discord.js").ChatInputCommandInteraction,
  context: import("@commands/CommandFactory").CommandContext
) => Promise<void>;

export type ItemRarity = "common" | "rare" | "epic";

export type ItemEffectTag =
  | "rps_reroll"
  | "rps_shield"
  | "rps_edge"
  | "scratch_reveal"
  | "scratch_luck"
  | "scratch_bonus"
  | "blackjack_edge"
  | "blackjack_peek"
  | "blackjack_boost"
  | "flip_reroll"
  | "flip_bonus"
  | "flip_refund"
  | "dice_reroll"
  | "dice_nudge"
  | "dice_payout"
  | "crash_insurance"
  | "crash_bonus"
  | "crash_auto"
  | "horse_boost"
  | "horse_start"
  | "horse_dash";

export interface EconomyItem {
  id: string;
  name: string;
  description: string;
  price: number;
  sellPrice: number;
  rarity: ItemRarity;
  type: "consumable" | "booster";
  effect?: ItemEffectTag;
  maxStack?: number;
}

export interface InventoryEntry {
  userId: string;
  guildId: string;
  itemId: string;
  quantity: number;
  updatedAt: number;
}

export interface MarketRotation {
  guildId: string;
  items: string[];
  generatedAt: number;
  expiresAt: number;
}

export interface MarketOffer {
  item: EconomyItem;
  rotationExpiresAt: number;
}

export interface DailyClaimResultSuccess {
  success: true;
  balance: number;
  nextAvailableAt: number;
}

export interface DailyClaimResultCooldown {
  success: false;
  nextAvailableAt: number;
}

export type DailyClaimResult =
  | DailyClaimResultSuccess
  | DailyClaimResultCooldown;

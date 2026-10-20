import type { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { EmbedFactory, RequireGuild } from "@utilities";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import { MAX_BET, MIN_BET } from "@systems/Economy/constants";
import type { EconomyItem, InventoryEntry } from "@systems/Economy/types";

/**
 * Builds the embed shown when a wager is rejected. Defaults to a standard warning embed.
 */
export type WagerWarningBuilder = (
  title: string,
  description: string,
  balance: number,
) => EmbedBuilder;

export interface PreparedWager {
  readonly bet: number;
  readonly manager: EconomyManager;
  /** Balance before any deduction. */
  readonly balance: number;
  readonly inventory: InventoryEntry[];
}

/**
 * Returns the rejection message for a bet outside [MIN_BET, MAX_BET], or null if valid.
 * A bet of 0 means "play for free" and is valid unless `allowFree` is false.
 */
export function BetRangeError(
  bet: number,
  options: { allowFree?: boolean } = {},
): string | null {
  if (bet === 0 && (options.allowFree ?? true)) {
    return null;
  }
  if (bet < MIN_BET || bet > MAX_BET) {
    return `Bet must be between ${MIN_BET} and ${MAX_BET}.`;
  }
  return null;
}

export async function ReplyEconomyWarning(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  embed: EmbedBuilder,
): Promise<void> {
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Reads the optional `bet` option, validates its range and the player's balance, and replies
 * with a warning if either check fails. Does not deduct the bet: games that lock the bet
 * later (e.g. after a confirmation button) deduct it themselves.
 *
 * @returns The prepared wager, or null if the player was told why it was rejected.
 */
export async function PrepareWager(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  buildWarning: WagerWarningBuilder = (title, description) =>
    EmbedFactory.CreateWarning({ title, description }),
): Promise<PreparedWager | null> {
  const bet = interaction.options.getInteger("bet") ?? 0;

  const rangeError = BetRangeError(bet);
  if (rangeError) {
    await ReplyEconomyWarning(
      interaction,
      context,
      buildWarning("Invalid Bet", rangeError, 0),
    );
    return null;
  }

  const manager = new EconomyManager(
    RequireGuild(interaction).id,
    context.databases.userDb,
  );
  const balance = manager.EnsureBalance(interaction.user.id);

  if (bet > balance) {
    await ReplyEconomyWarning(
      interaction,
      context,
      buildWarning(
        "Not Enough Coins",
        `You only have **${balance}** coins.`,
        balance,
      ),
    );
    return null;
  }

  return {
    bet,
    manager,
    balance,
    inventory: manager.GetInventory(interaction.user.id),
  };
}

/**
 * Whether the inventory holds at least one of the given item. Safe to call with an
 * item lookup that may be missing from the catalog.
 */
export function HasItem(
  inventory: readonly InventoryEntry[],
  item: EconomyItem | undefined,
): boolean {
  return (
    item !== undefined &&
    inventory.some((entry) => entry.itemId === item.id && entry.quantity > 0)
  );
}

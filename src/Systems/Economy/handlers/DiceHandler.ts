import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { BuildDiceResultEmbed } from "@systems/Economy/utils/Embeds";
import { DICE_PAYOUT_MULTIPLIER } from "../constants";
import { ITEM_MAP } from "../items";
import { EmbedFactory } from "@utilities";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import { HasItem, PrepareWager } from "@systems/Economy/utils/Wager";

export async function HandleDice(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  const guess = interaction.options.getInteger("guess");

  if (guess !== null && guess !== undefined && (guess < 1 || guess > 6)) {
    const embed = EmbedFactory.CreateWarning({
      title: "Invalid Guess",
      description: "Guess must be between 1 and 6.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const prepared = await PrepareWager(interaction, context);
  if (!prepared) {
    return;
  }
  const { bet, manager, inventory } = prepared;
  let balance = prepared.balance;

  const loadedDie = ITEM_MAP["loaded-die"];
  const hasLoadedDie = HasItem(inventory, loadedDie);
  const diceNudgeItem = ITEM_MAP["dice-nudge"];
  const hasDiceNudge = HasItem(inventory, diceNudgeItem);
  const diceJackpot = ITEM_MAP["dice-jackpot"];
  const hasJackpot = HasItem(inventory, diceJackpot);

  const rollDie = (): number => Math.floor(Math.random() * 6) + 1;
  let rolled = rollDie();
  let win = guess ? rolled === guess : false;
  const notes: string[] = [];

  // Deduct bet upfront
  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  let payout = 0;
  if (!win && guess && loadedDie && hasLoadedDie) {
    manager.AdjustInventoryItem({
      userId: interaction.user.id,
      itemId: loadedDie.id,
      delta: -1,
    });
    rolled = rollDie();
    win = rolled === guess;
    notes.push("Loaded Die — rerolled once.");
  }

  if (
    !win &&
    guess &&
    diceNudgeItem &&
    hasDiceNudge &&
    Math.abs((guess ?? 0) - rolled) === 1
  ) {
    manager.AdjustInventoryItem({
      userId: interaction.user.id,
      itemId: diceNudgeItem.id,
      delta: -1,
    });
    win = true;
    notes.push("Dice Nudge — off by 1 counted as win.");
  }

  if (bet > 0 && win) {
    payout = bet * DICE_PAYOUT_MULTIPLIER;
    if (diceJackpot && hasJackpot) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: diceJackpot.id,
        delta: -1,
      });
      payout += bet * DICE_PAYOUT_MULTIPLIER;
      notes.push("Dice Jackpot — payout doubled.");
    }
    balance = manager.AdjustBalance(interaction.user.id, payout, 0);
  }

  const embed = BuildDiceResultEmbed({
    rolled,
    guess,
    bet,
    win,
    payout,
    balance,
    note: notes.length ? notes.map((n) => `• ${n}`).join("\n") : undefined,
  });

  const outcome: EconomyOutcome = win ? "win" : bet > 0 ? "loss" : "neutral";
  AwardEconomyXp({
    interaction,
    context,
    bet,
    outcome,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
  });
}

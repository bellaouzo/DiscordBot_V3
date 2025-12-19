import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import { BuildDiceResultEmbed } from "@systems/Economy/utils/Embeds";
import { DICE_PAYOUT_MULTIPLIER, MAX_BET, MIN_BET } from "../constants";
import { ITEM_MAP } from "../items";
import { EmbedFactory } from "@utilities";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@systems/Economy/utils/EconomyXp";

export async function HandleDice(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  const guess = interaction.options.getInteger("guess");
  const bet = interaction.options.getInteger("bet") ?? 0;

  if (guess !== null && guess !== undefined && (guess < 1 || guess > 6)) {
    const embed = EmbedFactory.CreateWarning({
      title: "Invalid Guess",
      description: "Guess must be between 1 and 6.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (bet !== 0 && (bet < MIN_BET || bet > MAX_BET)) {
    const embed = EmbedFactory.CreateWarning({
      title: "Invalid Bet",
      description: `Bet must be between ${MIN_BET} and ${MAX_BET}.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const manager = new EconomyManager(interaction.guildId!, context.databases.userDb);
  let balance = manager.EnsureBalance(interaction.user.id);
  const inventory = manager.GetInventory(interaction.user.id);
  const loadedDie = ITEM_MAP["loaded-die"];
  const hasLoadedDie =
    loadedDie &&
    inventory.some(
      (entry) => entry.itemId === loadedDie.id && entry.quantity > 0
    );
  const diceNudgeItem = ITEM_MAP["dice-nudge"];
  const hasDiceNudge =
    diceNudgeItem &&
    inventory.some(
      (entry) => entry.itemId === diceNudgeItem.id && entry.quantity > 0
    );
  const diceJackpot = ITEM_MAP["dice-jackpot"];
  const hasJackpot =
    diceJackpot &&
    inventory.some(
      (entry) => entry.itemId === diceJackpot.id && entry.quantity > 0
    );

  if (bet > balance) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Enough Coins",
      description: `You only have **${balance}** coins.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const rollDie = (): number => Math.floor(Math.random() * 6) + 1;
  let rolled = rollDie();
  let win = guess ? rolled === guess : false;
  const notes: string[] = [];

  // Deduct bet upfront
  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  let payout = 0;
  if (!win && guess && hasLoadedDie) {
    manager.AdjustInventoryItem({
      userId: interaction.user.id,
      itemId: loadedDie!.id,
      delta: -1,
    });
    rolled = rollDie();
    win = rolled === guess;
    notes.push("Loaded Die — rerolled once.");
  }

  if (!win && guess && hasDiceNudge && Math.abs((guess ?? 0) - rolled) === 1) {
    manager.AdjustInventoryItem({
      userId: interaction.user.id,
      itemId: diceNudgeItem!.id,
      delta: -1,
    });
    win = true;
    notes.push("Dice Nudge — off by 1 counted as win.");
  }

  if (bet > 0 && win) {
    payout = bet * DICE_PAYOUT_MULTIPLIER;
    if (hasJackpot) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: diceJackpot!.id,
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

  const outcome: EconomyOutcome =
    win ? "win" : bet > 0 ? "loss" : "neutral";
  AwardEconomyXp({
    interaction,
    context,
    bet,
    outcome,
  });

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    ephemeral: false,
  });
}



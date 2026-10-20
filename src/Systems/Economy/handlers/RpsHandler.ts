import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import {
  BuildDisabledRpsButtons,
  BuildRpsButtons,
} from "@systems/Economy/utils/RpsComponents";
import {
  BuildRpsCancelledEmbed,
  BuildRpsExpiredEmbed,
  BuildRpsPromptEmbed,
  BuildRpsResultEmbed,
} from "@systems/Economy/utils/Embeds";
import { RPS_TIMEOUT_MS } from "@systems/Economy/constants";
import type { RpsChoice } from "@systems/Economy/types";
import { ITEM_MAP } from "@systems/Economy/items";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import { DetermineRpsOutcome } from "@systems/Economy/utils/rpsLogic";
import { HasItem, PrepareWager } from "@systems/Economy/utils/Wager";

interface RpsCustomIds {
  rock: string;
  paper: string;
  scissors: string;
  cancel: string;
}

export async function HandleRps(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;

  const prepared = await PrepareWager(interaction, context);
  if (!prepared) {
    return;
  }
  const { bet, manager, inventory } = prepared;
  let balanceValue = prepared.balance;

  const rerollItem = ITEM_MAP["reroll-token"];
  const hasReroll = HasItem(inventory, rerollItem);
  let rerollAvailable = hasReroll;
  const rpsShield = ITEM_MAP["rps-shield"];
  const hasShield = HasItem(inventory, rpsShield);
  let shieldAvailable = hasShield;
  const rpsEdge = ITEM_MAP["rps-edge"];
  const hasEdge = HasItem(inventory, rpsEdge);
  let edgeAvailable = hasEdge;

  let resolved = false;
  let timeoutHandle: NodeJS.Timeout | null = null;

  const customIds: RpsCustomIds = {
    rock: "",
    paper: "",
    scissors: "",
    cancel: "",
  };

  const registrations: Array<{ dispose: () => void }> = [];
  const disposeAll = (): void => {
    registrations.forEach((reg) => reg.dispose());
  };

  const finalizeTimeout = async (): Promise<void> => {
    if (resolved) return;
    resolved = true;
    disposeAll();

    if (bet > 0) {
      balanceValue = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildRpsExpiredEmbed({
      refunded: bet,
      balance: balanceValue,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: [BuildDisabledRpsButtons(customIds)],
      });
    } finally {
      void 0;
    }
  };

  const handleResult = async (
    buttonInteraction: ButtonInteraction,
    playerChoice: RpsChoice,
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This game has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    resolved = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    const rollBotChoice = (): RpsChoice =>
      ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)] as RpsChoice;

    let botChoice: RpsChoice = rollBotChoice();
    let outcome = DetermineRpsOutcome(playerChoice, botChoice);
    const notes: string[] = [];

    if (outcome === "loss" && rerollItem && rerollAvailable) {
      rerollAvailable = false;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: rerollItem.id,
        delta: -1,
      });
      botChoice = rollBotChoice();
      outcome = DetermineRpsOutcome(playerChoice, botChoice);
      notes.push("Reroll Token — rerolled opponent once.");
    }

    if (outcome === "loss" && rpsShield && shieldAvailable) {
      shieldAvailable = false;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: rpsShield.id,
        delta: -1,
      });
      outcome = "draw";
      notes.push("RPS Shield — converted loss to draw.");
    }

    if (outcome === "draw" && rpsEdge && edgeAvailable) {
      edgeAvailable = false;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: rpsEdge.id,
        delta: -1,
      });
      outcome = "win";
      notes.push("RPS Edge — draw converted to win.");
    }

    if (outcome === "win" && bet > 0) {
      balanceValue = manager.AdjustBalance(interaction.user.id, bet * 2);
    } else if (outcome === "draw" && bet > 0) {
      balanceValue = manager.AdjustBalance(interaction.user.id, bet);
    }

    const xpOutcome: EconomyOutcome =
      outcome === "win"
        ? "win"
        : outcome === "loss" && bet > 0
          ? "loss"
          : "neutral";
    AwardEconomyXp({
      interaction,
      context,
      bet,
      outcome: xpOutcome,
    });

    const resultEmbed = BuildRpsResultEmbed({
      botChoice,
      playerChoice,
      outcome,
      bet,
      balance: balanceValue,
      note: notes.length ? notes.map((n) => `• ${n}`).join("\n") : undefined,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [resultEmbed.toJSON()],
      components: [BuildDisabledRpsButtons(customIds)],
    });
  };

  const handleCancel = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This game has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    resolved = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    if (bet > 0) {
      balanceValue = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildRpsCancelledEmbed({
      refunded: bet,
      balance: balanceValue,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [embed.toJSON()],
      components: [BuildDisabledRpsButtons(customIds)],
    });
  };

  if (bet > 0) {
    balanceValue = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const rockRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: RPS_TIMEOUT_MS,
    handler: (buttonInteraction) => handleResult(buttonInteraction, "rock"),
  });
  const paperRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: RPS_TIMEOUT_MS,
    handler: (buttonInteraction) => handleResult(buttonInteraction, "paper"),
  });
  const scissorsRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: RPS_TIMEOUT_MS,
    handler: (buttonInteraction) => handleResult(buttonInteraction, "scissors"),
  });
  const cancelRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: RPS_TIMEOUT_MS,
    handler: (buttonInteraction) => handleCancel(buttonInteraction),
  });

  registrations.push(
    rockRegistration,
    paperRegistration,
    scissorsRegistration,
    cancelRegistration,
  );
  customIds.rock = rockRegistration.customId;
  customIds.paper = paperRegistration.customId;
  customIds.scissors = scissorsRegistration.customId;
  customIds.cancel = cancelRegistration.customId;

  const promptEmbed = BuildRpsPromptEmbed({
    bet,
    balanceAfterBet: balanceValue,
  });

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [BuildRpsButtons(customIds)],
  });

  if (!replyResult.success) {
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, bet);
    }
    disposeAll();
    return;
  }

  timeoutHandle = setTimeout(() => {
    void finalizeTimeout();
  }, RPS_TIMEOUT_MS);
}

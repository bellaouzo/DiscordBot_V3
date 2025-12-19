import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/Economy/EconomyManager";
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
import {
  MAX_BET,
  MIN_BET,
  RPS_TIMEOUT_MS,
} from "@systems/Economy/constants";
import { RpsChoice } from "@systems/Economy/types";
import { ITEM_MAP } from "@systems/Economy/items";
import { EmbedFactory } from "@utilities";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@systems/Economy/utils/EconomyXp";

interface RpsCustomIds {
  rock: string;
  paper: string;
  scissors: string;
  cancel: string;
}

function DetermineOutcome(
  player: RpsChoice,
  bot: RpsChoice
): "win" | "loss" | "draw" {
  if (player === bot) {
    return "draw";
  }

  const beats: Record<RpsChoice, RpsChoice> = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };

  return beats[player] === bot ? "win" : "loss";
}

export async function HandleRps(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;

  const bet = interaction.options.getInteger("bet") ?? 0;

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
  let balanceValue = manager.EnsureBalance(interaction.user.id);
  const inventory = manager.GetInventory(interaction.user.id);
  const rerollItem = ITEM_MAP["reroll-token"];
  const hasReroll =
    rerollItem &&
    inventory.some(
      (entry) => entry.itemId === rerollItem.id && entry.quantity > 0
    );
  let rerollAvailable = hasReroll;
  const rpsShield = ITEM_MAP["rps-shield"];
  const hasShield =
    rpsShield &&
    inventory.some(
      (entry) => entry.itemId === rpsShield.id && entry.quantity > 0
    );
  let shieldAvailable = hasShield;
  const rpsEdge = ITEM_MAP["rps-edge"];
  const hasEdge =
    rpsEdge &&
    inventory.some(
      (entry) => entry.itemId === rpsEdge.id && entry.quantity > 0
    );
  let edgeAvailable = hasEdge;

  if (bet > balanceValue) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Enough Coins",
      description: `You only have **${balanceValue}** coins.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

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
    }
  };

  const handleResult = async (
    buttonInteraction: ButtonInteraction,
    playerChoice: RpsChoice
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This game has already finished.",
        ephemeral: true,
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
    let outcome = DetermineOutcome(playerChoice, botChoice);
    const notes: string[] = [];

    if (outcome === "loss" && rerollAvailable) {
      rerollAvailable = false;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: rerollItem!.id,
        delta: -1,
      });
      botChoice = rollBotChoice();
      outcome = DetermineOutcome(playerChoice, botChoice);
      notes.push("Reroll Token — rerolled opponent once.");
    }

    if (outcome === "loss" && shieldAvailable) {
      shieldAvailable = false;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: rpsShield!.id,
        delta: -1,
      });
      outcome = "draw";
      notes.push("RPS Shield — converted loss to draw.");
    }

    if (outcome === "draw" && edgeAvailable) {
      edgeAvailable = false;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: rpsEdge!.id,
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
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This game has already finished.",
        ephemeral: true,
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
    cancelRegistration
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
    ephemeral: false,
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



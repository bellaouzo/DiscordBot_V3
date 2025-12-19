import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import { ITEM_MAP } from "@systems/Economy/items";
import {
  BuildHorseButtons,
  BuildDisabledHorseButtons,
} from "@systems/Economy/utils/HorseComponents";
import {
  BuildHorseCancelledEmbed,
  BuildHorseExpiredEmbed,
  BuildHorseProgressEmbed,
  BuildHorsePromptEmbed,
  BuildHorseResultEmbed,
} from "@systems/Economy/utils/Embeds";
import {
  HORSE_PAYOUT_MULTIPLIER,
  HORSE_TICK_MS,
  HORSE_TIMEOUT_MS,
  HORSE_TRACK_LENGTH,
  MAX_BET,
  MIN_BET,
} from "@systems/Economy/constants";
import { HorseId } from "@systems/Economy/types";
import { EmbedFactory } from "@utilities";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@systems/Economy/utils/EconomyXp";

interface HorseCustomIds {
  horses: string[];
  cancel: string;
}

const HORSE_EMOJIS = ["🐎", "🦄", "🐴", "🫏"];

export async function HandleHorseRace(
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

  const manager = new EconomyManager(
    interaction.guildId!,
    context.databases.userDb
  );
  let balance = manager.EnsureBalance(interaction.user.id);
  const inventory = manager.GetInventory(interaction.user.id);
  const spurItem = ITEM_MAP["speed-spur"];
  const hasSpur =
    spurItem &&
    inventory.some(
      (entry) => entry.itemId === spurItem.id && entry.quantity > 0
    );
  const whistleItem = ITEM_MAP["horse-whistle"];
  const hasWhistle =
    whistleItem &&
    inventory.some(
      (entry) => entry.itemId === whistleItem.id && entry.quantity > 0
    );
  const rocketItem = ITEM_MAP["horse-rocket"];
  const hasRocket =
    rocketItem &&
    inventory.some(
      (entry) => entry.itemId === rocketItem.id && entry.quantity > 0
    );
  let spurConsumed = false;
  let whistleConsumed = false;
  let rocketConsumed = false;
  const notes: string[] = [];

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

  let resolved = false;
  let selectedHorse: HorseId | null = null;
  let intervalHandle: NodeJS.Timeout | null = null;
  let timeoutHandle: NodeJS.Timeout | null = null;

  const customIds: HorseCustomIds = {
    horses: ["", "", "", ""],
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
      balance = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildHorseExpiredEmbed({
      refunded: bet,
      balance,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: BuildDisabledHorseButtons(customIds, horseLabels),
      });
    } finally {
      if (intervalHandle) {
        clearInterval(intervalHandle);
      }
    }
  };

  const horseLabels = HORSE_EMOJIS.map(
    (emoji, index) => `${emoji} Horse ${index + 1}`
  );

  const handleCancel = async (
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This race has already finished.",
        ephemeral: true,
      });
      return;
    }

    resolved = true;
    if (intervalHandle) {
      clearInterval(intervalHandle);
    }
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    if (bet > 0) {
      balance = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildHorseCancelledEmbed({
      refunded: bet,
      balance,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [embed.toJSON()],
      components: BuildDisabledHorseButtons(customIds, horseLabels),
    });
  };

  const startRace = async (
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This race has already finished.",
        ephemeral: true,
      });
      return;
    }

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    if (selectedHorse === null) {
      return;
    }

    if (hasSpur && spurItem && !spurConsumed) {
      spurConsumed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: spurItem.id,
        delta: -1,
      });
      notes.push("Speed Spur — higher advance chance.");
    }

    let headStart = 0;
    if (hasWhistle && whistleItem && !whistleConsumed) {
      whistleConsumed = true;
      headStart += 1;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: whistleItem.id,
        delta: -1,
      });
      notes.push("Horse Whistle — head start +1.");
    }
    if (hasRocket && rocketItem && !rocketConsumed) {
      rocketConsumed = true;
      headStart += 2;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: rocketItem.id,
        delta: -1,
      });
      notes.push("Rocket Saddle — head start +2.");
    }

    const positions = [0, 0, 0, 0];
    if (headStart > 0 && selectedHorse !== null) {
      positions[selectedHorse] = headStart;
    }
    const trackLength = HORSE_TRACK_LENGTH;

    // Disable buttons once race starts
    await buttonResponder.Update(buttonInteraction, {
      embeds: [
        BuildHorseProgressEmbed({
          bet,
          horses: horseLabels,
          positions,
          trackLength,
          note: notes.length
            ? notes.map((n) => `• ${n}`).join("\n")
            : undefined,
        }).toJSON(),
      ],
      components: BuildDisabledHorseButtons(customIds, horseLabels),
    });

    intervalHandle = setInterval(() => {
      if (resolved) {
        return;
      }

      positions.forEach((_, idx) => {
        const baseChance = 0.65;
        const bonus =
          hasSpur && spurConsumed && selectedHorse === idx ? 0.2 : 0;
        const advance =
          Math.random() < Math.min(0.95, baseChance + bonus) ? 1 : 0; // bias forward
        positions[idx] = positions[idx] + advance;
      });

      const leading = positions.findIndex((p) => p >= trackLength);
      const progressEmbed = BuildHorseProgressEmbed({
        bet,
        horses: horseLabels,
        positions,
        trackLength,
        note: notes.length ? notes.map((n) => `• ${n}`).join("\n") : undefined,
      });

      void interaction
        .editReply({
          embeds: [progressEmbed.toJSON()],
          components: BuildDisabledHorseButtons(customIds, horseLabels),
        })
        .catch(() => {});

      if (leading !== -1) {
        resolved = true;
        if (intervalHandle) {
          clearInterval(intervalHandle);
        }
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        disposeAll();

        const winner = leading as HorseId;
        const playerHorse = selectedHorse ?? winner;
        let payout = 0;
        if (bet > 0 && winner === playerHorse) {
          payout = bet * HORSE_PAYOUT_MULTIPLIER;
          balance = manager.AdjustBalance(interaction.user.id, payout);
        }

        const xpOutcome: EconomyOutcome =
          payout > 0 ? "win" : bet > 0 ? "loss" : "neutral";
        AwardEconomyXp({
          interaction,
          context,
          bet,
          outcome: xpOutcome,
        });

        const resultEmbed = BuildHorseResultEmbed({
          bet,
          playerHorse,
          winningHorse: winner,
          payout,
          balance,
          horses: horseLabels,
          note: notes.length
            ? notes.map((n) => `• ${n}`).join("\n")
            : undefined,
        });

        void interaction
          .editReply({
            embeds: [resultEmbed.toJSON()],
            components: BuildDisabledHorseButtons(customIds, horseLabels),
          })
          .catch(() => {});
      }
    }, HORSE_TICK_MS);
  };

  const handleSelectHorse = async (
    buttonInteraction: ButtonInteraction,
    horseIndex: HorseId
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This race has already finished.",
        ephemeral: true,
      });
      return;
    }

    selectedHorse = horseIndex;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    // Keep bet locked; already deducted below
    await startRace(buttonInteraction);
  };

  const horseRegistrations = HORSE_EMOJIS.map((_, index) =>
    componentRouter.RegisterButton({
      ownerId: interaction.user.id,
      expiresInMs: HORSE_TIMEOUT_MS,
      handler: (buttonInteraction) =>
        handleSelectHorse(buttonInteraction, index as HorseId),
    })
  );

  const cancelRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: HORSE_TIMEOUT_MS,
    handler: (buttonInteraction) => handleCancel(buttonInteraction),
  });

  registrations.push(...horseRegistrations, cancelRegistration);
  horseRegistrations.forEach((reg, idx) => {
    customIds.horses[idx] = reg.customId;
  });
  customIds.cancel = cancelRegistration.customId;

  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const promptEmbed = BuildHorsePromptEmbed({
    bet,
    balanceAfterBet: balance,
    horses: horseLabels,
  });

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: BuildHorseButtons(customIds, horseLabels),
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
  }, HORSE_TIMEOUT_MS);
}

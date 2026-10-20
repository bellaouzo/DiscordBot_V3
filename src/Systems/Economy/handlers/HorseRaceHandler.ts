import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
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
} from "@systems/Economy/constants";
import type { HorseId } from "@systems/Economy/types";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import { HasItem, PrepareWager } from "@systems/Economy/utils/Wager";
import { InteractiveSession } from "@shared/InteractiveSession";

interface HorseCustomIds {
  horses: string[];
  cancel: string;
}

const HORSE_EMOJIS = ["🐎", "🦄", "🐴", "🫏"];

export async function HandleHorseRace(
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
  let balance = prepared.balance;

  const spurItem = ITEM_MAP["speed-spur"];
  const hasSpur = HasItem(inventory, spurItem);
  const whistleItem = ITEM_MAP["horse-whistle"];
  const hasWhistle = HasItem(inventory, whistleItem);
  const rocketItem = ITEM_MAP["horse-rocket"];
  const hasRocket = HasItem(inventory, rocketItem);
  let spurConsumed = false;
  let whistleConsumed = false;
  let rocketConsumed = false;
  const notes: string[] = [];

  let selectedHorse: HorseId | null = null;
  let intervalHandle: NodeJS.Timeout | null = null;

  const customIds: HorseCustomIds = {
    horses: ["", "", "", ""],
    cancel: "",
  };

  const finalizeTimeout = async (): Promise<void> => {
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
    (emoji, index) => `${emoji} Horse ${index + 1}`,
  );

  const handleCancel = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (!session.Resolve()) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This race has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (intervalHandle) {
      clearInterval(intervalHandle);
    }

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
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (session.IsResolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This race has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    session.StopTimer();

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
      if (session.IsResolved) {
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
        session.Resolve();
        if (intervalHandle) {
          clearInterval(intervalHandle);
        }

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
    horseIndex: HorseId,
  ): Promise<void> => {
    if (session.IsResolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This race has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    selectedHorse = horseIndex;
    session.StopTimer();

    // Keep bet locked; already deducted below
    await startRace(buttonInteraction);
  };

  const session = new InteractiveSession({
    componentRouter,
    ownerId: interaction.user.id,
    timeoutMs: HORSE_TIMEOUT_MS,
    onTimeout: finalizeTimeout,
  });
  HORSE_EMOJIS.forEach((_, index) => {
    customIds.horses[index] = session.RegisterButton((buttonInteraction) =>
      handleSelectHorse(buttonInteraction, index as HorseId),
    );
  });
  customIds.cancel = session.RegisterButton(handleCancel);

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
  });

  if (!replyResult.success) {
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, bet);
    }
    session.Resolve();
    return;
  }

  session.Start();
}

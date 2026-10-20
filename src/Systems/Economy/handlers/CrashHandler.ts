import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { ITEM_MAP } from "@systems/Economy/items";
import {
  BuildCrashButtons,
  BuildDisabledCrashButtons,
} from "@systems/Economy/utils/CrashComponents";
import {
  BuildCrashCancelledEmbed,
  BuildCrashCashoutEmbed,
  BuildCrashCrashedEmbed,
  BuildCrashExpiredEmbed,
  BuildCrashProgressEmbed,
  BuildCrashPromptEmbed,
} from "@systems/Economy/utils/Embeds";
import { CRASH_TICK_MS, CRASH_TIMEOUT_MS } from "@systems/Economy/constants";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import {
  AdvanceCrashMultiplier,
  ApplyCrashBoosterBonus,
  CalculateCrashPayout,
  GenerateCrashPoint,
  HasReachedCrashPoint,
  ShouldAutoCashOut,
} from "@systems/Economy/utils/crashLogic";
import { HasItem, PrepareWager } from "@systems/Economy/utils/Wager";

interface CrashCustomIds {
  cashout: string;
  cancel: string;
}

export async function HandleCrash(
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

  const parachute = ITEM_MAP["parachute"];
  const hasParachute = HasItem(inventory, parachute);
  let parachuteUsed = false;
  const crashBooster = ITEM_MAP["crash-booster"];
  const hasBooster = HasItem(inventory, crashBooster);
  const autoCashItem = ITEM_MAP["crash-autocash"];
  const hasAutoCash = HasItem(inventory, autoCashItem);
  let autoCashUsed = false;

  let resolved = false;
  let intervalHandle: NodeJS.Timeout | null = null;
  let timeoutHandle: NodeJS.Timeout | null = null;

  const customIds: CrashCustomIds = {
    cashout: "",
    cancel: "",
  };

  const registrations: Array<{ dispose: () => void }> = [];
  const disposeAll = (): void => {
    registrations.forEach((reg) => reg.dispose());
  };

  const crashPoint = GenerateCrashPoint(Math.random());
  let multiplier = 1.0;

  const finalizeTimeout = async (): Promise<void> => {
    if (resolved) return;
    resolved = true;
    disposeAll();

    if (bet > 0) {
      balance = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildCrashExpiredEmbed({
      refunded: bet,
      balance,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: [BuildDisabledCrashButtons(customIds)],
      });
    } finally {
      if (intervalHandle) {
        clearInterval(intervalHandle);
      }
    }
  };

  const finalizeCrash = async (crashAt: number): Promise<void> => {
    if (resolved) return;
    resolved = true;
    if (intervalHandle) {
      clearInterval(intervalHandle);
    }
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    let note: string | undefined;
    if (bet > 0 && parachute && hasParachute && !parachuteUsed) {
      parachuteUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: parachute.id,
        delta: -1,
      });
      balance = manager.AdjustBalance(interaction.user.id, bet);
      note = "Parachute consumed: bet refunded after crash.";
    }

    const crashEmbed = BuildCrashCrashedEmbed({
      crashedAt: crashAt,
      bet,
      balance,
      note,
    });

    const xpOutcome: EconomyOutcome =
      bet > 0 && !parachuteUsed ? "loss" : "neutral";
    AwardEconomyXp({
      interaction,
      context,
      bet,
      outcome: xpOutcome,
    });

    await interaction.editReply({
      embeds: [crashEmbed.toJSON()],
      components: [BuildDisabledCrashButtons(customIds)],
    });
  };

  const finalizeCashout = async (
    sourceInteraction?: ButtonInteraction,
    extraNote?: string,
  ): Promise<void> => {
    if (resolved) {
      if (sourceInteraction) {
        await buttonResponder.Reply(sourceInteraction, {
          content: "This game has already finished.",
          flags: MessageFlags.Ephemeral,
        });
      }
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

    let payout = CalculateCrashPayout(bet, multiplier);
    const notes: string[] = [];
    if (extraNote) {
      notes.push(extraNote);
    }
    if (payout > 0) {
      if (crashBooster && hasBooster) {
        manager.AdjustInventoryItem({
          userId: interaction.user.id,
          itemId: crashBooster.id,
          delta: -1,
        });
        const boosted = ApplyCrashBoosterBonus(payout);
        payout = boosted.payout;
        notes.push("Crash Booster — +15% payout.");
      }
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

    const embed = BuildCrashCashoutEmbed({
      bet,
      multiplier,
      payout: bet > 0 ? payout : 0,
      balance,
    });
    const noteText =
      notes.length > 0 ? notes.map((n) => `• ${n}`).join("\n") : undefined;

    if (sourceInteraction) {
      await buttonResponder.Update(sourceInteraction, {
        embeds: [
          embed
            .setDescription(
              `${embed.data.description ?? ""}${noteText ? `\n**Item Used:** ${noteText}` : ""}`,
            )
            .toJSON(),
        ],
        components: [BuildDisabledCrashButtons(customIds)],
      });
    } else {
      await interaction.editReply({
        embeds: [
          embed
            .setDescription(
              `${embed.data.description ?? ""}${noteText ? `\n**Item Used:** ${noteText}` : ""}`,
            )
            .toJSON(),
        ],
        components: [BuildDisabledCrashButtons(customIds)],
      });
    }
  };

  const handleCashout = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    await finalizeCashout(buttonInteraction);
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

    const embed = BuildCrashCancelledEmbed({
      refunded: bet,
      balance,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [embed.toJSON()],
      components: [BuildDisabledCrashButtons(customIds)],
    });
  };

  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const cashoutRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: CRASH_TIMEOUT_MS,
    handler: (buttonInteraction) => handleCashout(buttonInteraction),
  });
  const cancelRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: CRASH_TIMEOUT_MS,
    handler: (buttonInteraction) => handleCancel(buttonInteraction),
  });

  registrations.push(cashoutRegistration, cancelRegistration);
  customIds.cashout = cashoutRegistration.customId;
  customIds.cancel = cancelRegistration.customId;

  const promptEmbed = BuildCrashPromptEmbed({
    bet,
    balanceAfterBet: balance,
    note: hasParachute
      ? "Parachute ready: crash will refund your bet once."
      : undefined,
  });

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [BuildCrashButtons(customIds)],
  });

  if (!replyResult.success) {
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, bet);
    }
    disposeAll();
    return;
  }

  intervalHandle = setInterval(() => {
    if (resolved) {
      return;
    }

    multiplier = AdvanceCrashMultiplier(multiplier, crashPoint);
    const displayMultiplier = Number(multiplier.toFixed(2));

    if (
      !resolved &&
      autoCashItem &&
      ShouldAutoCashOut(displayMultiplier, bet, hasAutoCash, autoCashUsed)
    ) {
      autoCashUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: autoCashItem.id,
        delta: -1,
      });
      void finalizeCashout(undefined, "Auto Cashout Chip — cashed at 2.0x.");
      return;
    }

    if (HasReachedCrashPoint(displayMultiplier, crashPoint)) {
      void finalizeCrash(displayMultiplier);
      return;
    }

    const progressEmbed = BuildCrashProgressEmbed({
      bet,
      multiplier: displayMultiplier,
      balanceAfterBet: balance,
    });

    void interaction
      .editReply({
        embeds: [progressEmbed.toJSON()],
        components: [BuildCrashButtons(customIds)],
      })
      .catch(() => {});
  }, CRASH_TICK_MS);

  timeoutHandle = setTimeout(() => {
    void finalizeTimeout();
  }, CRASH_TIMEOUT_MS);
}

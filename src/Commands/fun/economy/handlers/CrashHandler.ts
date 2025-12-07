import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@commands/fun/economy/EconomyManager";
import { ITEM_MAP } from "@commands/fun/economy/items";
import {
  BuildCrashButtons,
  BuildDisabledCrashButtons,
} from "@commands/fun/economy/utils/CrashComponents";
import {
  BuildCrashCancelledEmbed,
  BuildCrashCashoutEmbed,
  BuildCrashCrashedEmbed,
  BuildCrashExpiredEmbed,
  BuildCrashProgressEmbed,
  BuildCrashPromptEmbed,
} from "@commands/fun/economy/utils/Embeds";
import {
  CRASH_TICK_MS,
  CRASH_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
} from "@commands/fun/economy/constants";
import { EmbedFactory } from "@utilities";

interface CrashCustomIds {
  cashout: string;
  cancel: string;
}

export async function HandleCrash(
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

  const manager = new EconomyManager(interaction.guildId!, context.logger);
  let balance = manager.EnsureBalance(interaction.user.id);
  const inventory = manager.GetInventory(interaction.user.id);
  const parachute = ITEM_MAP["parachute"];
  const hasParachute =
    parachute &&
    inventory.some(
      (entry) => entry.itemId === parachute.id && entry.quantity > 0
    );
  let parachuteUsed = false;
  const crashBooster = ITEM_MAP["crash-booster"];
  const hasBooster =
    crashBooster &&
    inventory.some(
      (entry) => entry.itemId === crashBooster.id && entry.quantity > 0
    );
  const autoCashItem = ITEM_MAP["crash-autocash"];
  const hasAutoCash =
    autoCashItem &&
    inventory.some(
      (entry) => entry.itemId === autoCashItem.id && entry.quantity > 0
    );
  let autoCashUsed = false;

  if (bet > balance) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Enough Coins",
      description: `You only have **${balance}** coins.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    manager.Close();
    return;
  }

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

  const crashPoint = Math.max(1.1, 1 + Math.random() * 4.5);
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
      manager.Close();
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
    if (bet > 0 && hasParachute && !parachuteUsed) {
      parachuteUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: parachute!.id,
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

    await interaction.editReply({
      embeds: [crashEmbed.toJSON()],
      components: [BuildDisabledCrashButtons(customIds)],
    });

    manager.Close();
  };

  const finalizeCashout = async (
    sourceInteraction?: ButtonInteraction,
    extraNote?: string
  ): Promise<void> => {
    if (resolved) {
      if (sourceInteraction) {
        await buttonResponder.Reply(sourceInteraction, {
          content: "This game has already finished.",
          ephemeral: true,
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

    let payout = bet > 0 ? Math.floor(bet * multiplier) : 0;
    const notes: string[] = [];
    if (extraNote) {
      notes.push(extraNote);
    }
    if (payout > 0) {
      if (hasBooster) {
        manager.AdjustInventoryItem({
          userId: interaction.user.id,
          itemId: crashBooster!.id,
          delta: -1,
        });
        const bonus = Math.floor(payout * 0.15);
        payout += bonus;
        notes.push("Crash Booster — +15% payout.");
      }
      balance = manager.AdjustBalance(interaction.user.id, payout);
    }

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
              `${embed.data.description ?? ""}${noteText ? `\n**Item Used:** ${noteText}` : ""}`
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
              `${embed.data.description ?? ""}${noteText ? `\n**Item Used:** ${noteText}` : ""}`
            )
            .toJSON(),
        ],
        components: [BuildDisabledCrashButtons(customIds)],
      });
    }

    manager.Close();
  };

  const handleCashout = async (
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    await finalizeCashout(buttonInteraction);
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

    manager.Close();
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
    ephemeral: false,
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

    multiplier = Math.min(multiplier * 1.12, crashPoint + 0.5);
    const displayMultiplier = Number(multiplier.toFixed(2));

    if (
      !resolved &&
      hasAutoCash &&
      !autoCashUsed &&
      displayMultiplier >= 2.0 &&
      bet > 0
    ) {
      autoCashUsed = true;
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: autoCashItem!.id,
        delta: -1,
      });
      void finalizeCashout(undefined, "Auto Cashout Chip — cashed at 2.0x.");
      return;
    }

    if (displayMultiplier >= crashPoint) {
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

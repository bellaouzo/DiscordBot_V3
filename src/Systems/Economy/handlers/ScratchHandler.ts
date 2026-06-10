import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import {
  BuildScratchButtons,
  BuildDisabledScratchButtons,
} from "@systems/Economy/utils/ScratchComponents";
import {
  BuildScratchCancelledEmbed,
  BuildScratchExpiredEmbed,
  BuildScratchProgressEmbed,
  BuildScratchPromptEmbed,
  BuildScratchResultEmbed,
} from "@systems/Economy/utils/Embeds";
import {
  MAX_BET,
  MIN_BET,
  SCRATCH_TIMEOUT_MS,
} from "@systems/Economy/constants";
import { ScratchSymbol } from "@systems/Economy/types";
import { ITEM_MAP } from "@systems/Economy/items";
import { EmbedFactory } from "@utilities";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@systems/Economy/utils/EconomyXp";
import {
  ApplyScratchBonusLossRefund,
  ApplyScratchBonusPayout,
  ApplyScratchCloverPayout,
  ComputeScratchPayout,
  FillRemainingScratchReveals,
  PickRandomScratchSymbol,
  SCRATCH_COLUMNS,
  SCRATCH_HIDDEN_ICONS,
  SCRATCH_SLOTS,
  WinStillPossible,
} from "@systems/Economy/utils/scratchLogic";

interface ScratchCustomIds {
  slots: string[];
  cancel: string;
}

export async function HandleScratch(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const manager = new EconomyManager(
    interaction.guildId!,
    context.databases.userDb,
  );
  let balance = manager.EnsureBalance(interaction.user.id);
  const inventory = manager.GetInventory(interaction.user.id);
  const lensItem = ITEM_MAP["scratch-lens"];
  const lensEntry = inventory.find((entry) => entry.itemId === lensItem?.id);
  const hasLens = lensItem && lensEntry && lensEntry.quantity > 0;
  const cloverItem = ITEM_MAP["scratch-clover"];
  const hasClover =
    cloverItem &&
    inventory.some(
      (entry) => entry.itemId === cloverItem.id && entry.quantity > 0,
    );
  const bonusItem = ITEM_MAP["scratch-bonus"];
  const hasBonus =
    bonusItem &&
    inventory.some(
      (entry) => entry.itemId === bonusItem.id && entry.quantity > 0,
    );
  const lensNote = hasLens
    ? "Scratch Lens — extra reveal consumed."
    : undefined;

  if (bet > balance) {
    const embed = EmbedFactory.CreateWarning({
      title: "Not Enough Coins",
      description: `You only have **${balance}** coins.`,
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let resolved = false;
  let timeoutHandle: NodeJS.Timeout | null = null;
  const reveals: Array<ScratchSymbol | null> = Array.from(
    { length: SCRATCH_SLOTS },
    () => null,
  );
  const scratched = new Set<number>();

  const customIds: ScratchCustomIds = {
    slots: Array.from({ length: SCRATCH_SLOTS }, () => ""),
    cancel: "",
  };

  const registrations: Array<{ dispose: () => void }> = [];
  const disposeAll = (): void => {
    registrations.forEach((reg) => reg.dispose());
  };

  const allRevealed = (): boolean => reveals.every((r) => r !== null);

  const finalizeTimeout = async (): Promise<void> => {
    if (resolved) return;
    resolved = true;
    disposeAll();

    if (bet > 0) {
      balance = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildScratchExpiredEmbed({
      refunded: bet,
      balance,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: BuildDisabledScratchButtons(
          customIds,
          SCRATCH_HIDDEN_ICONS,
          SCRATCH_COLUMNS,
        ),
      });
    } finally {
      void 0;
    }
  };

  const finishGame = async (): Promise<void> => {
    resolved = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    FillRemainingScratchReveals(
      reveals,
      Array.from({ length: SCRATCH_SLOTS }, () => Math.random()),
    );

    let payout = ComputeScratchPayout(reveals, bet);
    const notes: string[] = [];

    if (payout === 0 && bet > 0 && hasClover) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: cloverItem!.id,
        delta: -1,
      });
      payout = ApplyScratchCloverPayout(bet);
      notes.push("Scratch Clover — guaranteed minimum pair payout.");
    }

    if (payout > 0 && hasBonus) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: bonusItem!.id,
        delta: -1,
      });
      const boosted = ApplyScratchBonusPayout(payout);
      payout = boosted.payout;
      notes.push("Lucky Sticker — +50% payout.");
    } else if (payout === 0 && bet > 0 && hasBonus) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: bonusItem!.id,
        delta: -1,
      });
      payout = ApplyScratchBonusLossRefund(bet);
      notes.push("Lucky Sticker — loss refunded 50%.");
    }

    if (payout > 0) {
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

    const resultEmbed = BuildScratchResultEmbed({
      bet,
      payout,
      balance,
      reveals: reveals as ScratchSymbol[],
      columns: SCRATCH_COLUMNS,
      note: [
        lensNote,
        notes.length ? notes.map((n) => `• ${n}`).join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    await interaction.editReply({
      embeds: [resultEmbed.toJSON()],
      components: BuildDisabledScratchButtons(
        customIds,
        SCRATCH_HIDDEN_ICONS,
        SCRATCH_COLUMNS,
      ),
    });
  };

  const handleScratch = async (
    buttonInteraction: ButtonInteraction,
    index: number,
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This card has already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (reveals[index] !== null) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "That spot is already scratched.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    reveals[index] = PickRandomScratchSymbol(Math.random());

    const progressEmbed = BuildScratchProgressEmbed({
      bet,
      reveals,
      hiddenIcons: SCRATCH_HIDDEN_ICONS,
      columns: SCRATCH_COLUMNS,
      note: lensNote,
    });

    scratched.add(index);

    await buttonResponder.Update(buttonInteraction, {
      embeds: [progressEmbed.toJSON()],
      components: BuildScratchButtons(
        customIds,
        SCRATCH_HIDDEN_ICONS,
        SCRATCH_COLUMNS,
        scratched,
      ),
    });

    if (!WinStillPossible(reveals)) {
      await finishGame();
      return;
    }

    if (allRevealed()) {
      await finishGame();
    }
  };

  const handleCancel = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This card has already finished.",
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
      balance = manager.AdjustBalance(interaction.user.id, bet);
    }

    const embed = BuildScratchCancelledEmbed({
      refunded: bet,
      balance,
    });

    await buttonResponder.Update(buttonInteraction, {
      embeds: [embed.toJSON()],
      components: BuildDisabledScratchButtons(
        customIds,
        SCRATCH_HIDDEN_ICONS,
        SCRATCH_COLUMNS,
      ),
    });
  };

  const slotRegistrations = Array.from({ length: SCRATCH_SLOTS }, (_, idx) =>
    componentRouter.RegisterButton({
      ownerId: interaction.user.id,
      expiresInMs: SCRATCH_TIMEOUT_MS,
      handler: (buttonInteraction) => handleScratch(buttonInteraction, idx),
    }),
  );

  const cancelRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: SCRATCH_TIMEOUT_MS,
    handler: (buttonInteraction) => handleCancel(buttonInteraction),
  });

  registrations.push(...slotRegistrations, cancelRegistration);
  slotRegistrations.forEach((reg, idx) => {
    customIds.slots[idx] = reg.customId;
  });
  customIds.cancel = cancelRegistration.customId;

  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  if (hasLens && lensItem) {
    const revealIndex = Math.floor(Math.random() * SCRATCH_SLOTS);
    reveals[revealIndex] = PickRandomScratchSymbol(Math.random());
    manager.AdjustInventoryItem({
      userId: interaction.user.id,
      itemId: lensItem.id,
      delta: -1,
    });
  }

  const promptEmbed = BuildScratchPromptEmbed({
    bet,
    balanceAfterBet: balance,
    hiddenIcons: SCRATCH_HIDDEN_ICONS,
    columns: SCRATCH_COLUMNS,
    note: lensNote,
  });

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: BuildScratchButtons(
      customIds,
      SCRATCH_HIDDEN_ICONS,
      SCRATCH_COLUMNS,
    ),
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
  }, SCRATCH_TIMEOUT_MS);
}

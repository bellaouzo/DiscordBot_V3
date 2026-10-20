import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
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
import { SCRATCH_TIMEOUT_MS } from "@systems/Economy/constants";
import type { ScratchSymbol } from "@systems/Economy/types";
import { ITEM_MAP } from "@systems/Economy/items";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
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
import { HasItem, PrepareWager } from "@systems/Economy/utils/Wager";

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

  const prepared = await PrepareWager(interaction, context);
  if (!prepared) {
    return;
  }
  const { bet, manager, inventory } = prepared;
  let balance = prepared.balance;

  const lensItem = ITEM_MAP["scratch-lens"];
  const hasLens = HasItem(inventory, lensItem);
  const cloverItem = ITEM_MAP["scratch-clover"];
  const hasClover = HasItem(inventory, cloverItem);
  const bonusItem = ITEM_MAP["scratch-bonus"];
  const hasBonus = HasItem(inventory, bonusItem);
  const lensNote = hasLens
    ? "Scratch Lens — extra reveal consumed."
    : undefined;

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

    if (payout === 0 && bet > 0 && cloverItem && hasClover) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: cloverItem.id,
        delta: -1,
      });
      payout = ApplyScratchCloverPayout(bet);
      notes.push("Scratch Clover — guaranteed minimum pair payout.");
    }

    if (payout > 0 && bonusItem && hasBonus) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: bonusItem.id,
        delta: -1,
      });
      const boosted = ApplyScratchBonusPayout(payout);
      payout = boosted.payout;
      notes.push("Lucky Sticker — +50% payout.");
    } else if (payout === 0 && bet > 0 && bonusItem && hasBonus) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: bonusItem.id,
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

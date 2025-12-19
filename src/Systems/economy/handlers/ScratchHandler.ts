import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/economy/EconomyManager";
import {
  BuildScratchButtons,
  BuildDisabledScratchButtons,
} from "@systems/economy/utils/ScratchComponents";
import {
  BuildScratchCancelledEmbed,
  BuildScratchExpiredEmbed,
  BuildScratchProgressEmbed,
  BuildScratchPromptEmbed,
  BuildScratchResultEmbed,
} from "@systems/economy/utils/Embeds";
import {
  MAX_BET,
  MIN_BET,
  SCRATCH_TIMEOUT_MS,
} from "@systems/economy/constants";
import { ScratchSymbol } from "@systems/economy/types";
import { ITEM_MAP } from "@systems/economy/items";
import { EmbedFactory } from "@utilities";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@systems/economy/utils/EconomyXp";

interface ScratchCustomIds {
  slots: string[];
  cancel: string;
}

const SCRATCH_COLUMNS = 3;
const SCRATCH_ROWS = 3;
const SCRATCH_SLOTS = SCRATCH_COLUMNS * SCRATCH_ROWS;
const SCRATCH_SYMBOLS: ScratchSymbol[] = ["💰", "⭐", "🍀", "🍒"];
const SCRATCH_HIDDEN_ICONS = [
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
];

export async function HandleScratch(
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
  const lensItem = ITEM_MAP["scratch-lens"];
  const lensEntry = inventory.find((entry) => entry.itemId === lensItem?.id);
  const hasLens = lensItem && lensEntry && lensEntry.quantity > 0;
  const cloverItem = ITEM_MAP["scratch-clover"];
  const hasClover =
    cloverItem &&
    inventory.some(
      (entry) => entry.itemId === cloverItem.id && entry.quantity > 0
    );
  const bonusItem = ITEM_MAP["scratch-bonus"];
  const hasBonus =
    bonusItem &&
    inventory.some(
      (entry) => entry.itemId === bonusItem.id && entry.quantity > 0
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
      ephemeral: true,
    });
    return;
  }

  let resolved = false;
  let timeoutHandle: NodeJS.Timeout | null = null;
  const reveals: Array<ScratchSymbol | null> = Array.from(
    { length: SCRATCH_SLOTS },
    () => null
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

  const fillRemainingReveals = (): void => {
    for (let i = 0; i < reveals.length; i++) {
      if (reveals[i] === null) {
        reveals[i] =
          SCRATCH_SYMBOLS[Math.floor(Math.random() * SCRATCH_SYMBOLS.length)];
      }
    }
  };

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
          SCRATCH_COLUMNS
        ),
      });
    } finally {
    }
  };

  const computePayout = (): number => {
    const counts = reveals.reduce<Record<ScratchSymbol, number>>(
      (acc, sym) => {
        if (sym) {
          acc[sym] = (acc[sym] ?? 0) + 1;
        }
        return acc;
      },
      { "💰": 0, "⭐": 0, "🍀": 0, "🍒": 0 }
    );

    const maxCount = Math.max(...Object.values(counts));
    if (bet === 0) return 0;
    if (maxCount === 3) return bet * 5;
    if (maxCount === 2) return bet * 2;
    return 0;
  };

  const winStillPossible = (): boolean => {
    const counts = reveals.reduce<Record<ScratchSymbol, number>>(
      (acc, sym) => {
        if (sym) {
          acc[sym] = (acc[sym] ?? 0) + 1;
        }
        return acc;
      },
      { "💰": 0, "⭐": 0, "🍀": 0, "🍒": 0 }
    );
    const remaining = reveals.filter((r) => r === null).length;
    const maxCount = Math.max(...Object.values(counts));
    // Need at least a pair to win
    return maxCount + remaining >= 2;
  };

  const finishGame = async (): Promise<void> => {
    resolved = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    fillRemainingReveals();

    let payout = computePayout();
    const notes: string[] = [];

    if (payout === 0 && bet > 0 && hasClover) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: cloverItem!.id,
        delta: -1,
      });
      payout = bet * 2;
      notes.push("Scratch Clover — guaranteed minimum pair payout.");
    }

    if (payout > 0 && hasBonus) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: bonusItem!.id,
        delta: -1,
      });
      const bonus = Math.floor(payout * 0.5);
      payout += bonus;
      notes.push("Lucky Sticker — +50% payout.");
    } else if (payout === 0 && bet > 0 && hasBonus) {
      manager.AdjustInventoryItem({
        userId: interaction.user.id,
        itemId: bonusItem!.id,
        delta: -1,
      });
      payout = Math.floor(bet * 0.5);
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
        SCRATCH_COLUMNS
      ),
    });
  };

  const handleScratch = async (
    buttonInteraction: ButtonInteraction,
    index: number
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This card has already finished.",
        ephemeral: true,
      });
      return;
    }

    if (reveals[index] !== null) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "That spot is already scratched.",
        ephemeral: true,
      });
      return;
    }

    reveals[index] =
      SCRATCH_SYMBOLS[Math.floor(Math.random() * SCRATCH_SYMBOLS.length)];

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
        scratched
      ),
    });

    if (!winStillPossible()) {
      await finishGame();
      return;
    }

    if (allRevealed()) {
      await finishGame();
    }
  };

  const handleCancel = async (
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This card has already finished.",
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
        SCRATCH_COLUMNS
      ),
    });
  };

  const slotRegistrations = Array.from({ length: SCRATCH_SLOTS }, (_, idx) =>
    componentRouter.RegisterButton({
      ownerId: interaction.user.id,
      expiresInMs: SCRATCH_TIMEOUT_MS,
      handler: (buttonInteraction) => handleScratch(buttonInteraction, idx),
    })
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
    reveals[revealIndex] =
      SCRATCH_SYMBOLS[Math.floor(Math.random() * SCRATCH_SYMBOLS.length)];
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
      SCRATCH_COLUMNS
    ),
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
  }, SCRATCH_TIMEOUT_MS);
}

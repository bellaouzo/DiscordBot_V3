import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import { BuildSlotsResultEmbed } from "@systems/Economy/utils/Embeds";
import {
  BuildDisabledSlotsButtons,
  BuildSlotsButtons,
} from "@systems/Economy/utils/SlotsComponents";
import {
  MAX_BET,
  MIN_BET,
  SLOTS_TIMEOUT_MS,
} from "@systems/Economy/constants";
import { EmbedFactory } from "@utilities";
import {
  AwardEconomyXp,
  EconomyOutcome,
} from "@systems/Economy/utils/EconomyXp";

type SlotSymbol = {
  icon: string;
  weight: number;
  tripleMultiplier: number;
  pairMultiplier: number;
};

const SLOT_SYMBOLS: SlotSymbol[] = [
  { icon: "🍒", weight: 25, tripleMultiplier: 5, pairMultiplier: 2 },
  { icon: "🍋", weight: 22, tripleMultiplier: 4, pairMultiplier: 2 },
  { icon: "🔔", weight: 16, tripleMultiplier: 7, pairMultiplier: 2.5 },
  { icon: "⭐", weight: 14, tripleMultiplier: 9, pairMultiplier: 3 },
  { icon: "7️⃣", weight: 10, tripleMultiplier: 14, pairMultiplier: 4 },
  { icon: "💎", weight: 6, tripleMultiplier: 18, pairMultiplier: 5 },
  { icon: "🍀", weight: 12, tripleMultiplier: 10, pairMultiplier: 3.5 },
];

function spinReel(): string {
  const totalWeight = SLOT_SYMBOLS.reduce(
    (sum, symbol) => sum + symbol.weight,
    0
  );
  const roll = Math.random() * totalWeight;
  let cumulative = 0;
  for (const symbol of SLOT_SYMBOLS) {
    cumulative += symbol.weight;
    if (roll <= cumulative) {
      return symbol.icon;
    }
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1].icon;
}

function getSymbolData(icon: string): SlotSymbol | undefined {
  return SLOT_SYMBOLS.find((s) => s.icon === icon);
}

function evaluateSpin(
  middleRow: string[],
  bet: number
): {
  payout: number;
  outcome: string;
} {
  if (bet <= 0) {
    return { payout: 0, outcome: "Free spin (no bet placed)." };
  }

  const counts = middleRow.reduce<Record<string, number>>((map, icon) => {
    map[icon] = (map[icon] ?? 0) + 1;
    return map;
  }, {});

  const triples = Object.entries(counts).find(([, count]) => count === 3);
  if (triples) {
    const [icon] = triples;
    const symbol = getSymbolData(icon);
    const multiplier = symbol?.tripleMultiplier ?? 6;
    const payout = Math.floor(bet * multiplier);
    return {
      payout,
      outcome: `Triple ${icon}! ${multiplier}x payout.`,
    };
  }

  const pair = Object.entries(counts).find(([, count]) => count === 2);
  if (pair) {
    const [icon] = pair;
    const symbol = getSymbolData(icon);
    const multiplier = symbol?.pairMultiplier ?? 2;
    const payout = Math.floor(bet * multiplier);
    return {
      payout,
      outcome: `Pair of ${icon}! ${multiplier.toFixed(1).replace(/\.0$/, "")}x payout.`,
    };
  }

  const hasClover = counts["🍀"] ?? 0;
  if (hasClover > 0) {
    const consolation = Math.max(1, Math.floor(bet * 0.5));
    return {
      payout: consolation,
      outcome: "🍀 Clover consolation — 0.5x return.",
    };
  }

  return { payout: 0, outcome: "No matches." };
}

export async function HandleSlots(
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
  let balance = manager.EnsureBalance(interaction.user.id);

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

  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const customIds = { spin: "" };
  const registrations: Array<{ dispose: () => void }> = [];
  let resolved = false;
  let timeoutHandle: NodeJS.Timeout | null = null;

  const disposeAll = (): void => {
    registrations.forEach((reg) => reg.dispose());
  };

  const placeholder = Array(9).fill("❔");

  const buildGrid = (state: string[]): string => {
    const [a, b, c, d, e, f, g, h, i] = state;
    return `${a} ${b} ${c}\n${d} ${e} ${f}\n${g} ${h} ${i}`;
  };

  const buildSpinEmbed = (
    state: string[],
    label: string
  ): ReturnType<typeof EmbedFactory.Create> => {
    const lines = [
      buildGrid(state),
      "",
      label,
      bet > 0
        ? `Bet locked: **${bet}** | Balance after bet: **${balance}**`
        : "No bet placed.",
    ];
    return EmbedFactory.Create({
      title: "🎰 Slots",
      description: lines.join("\n"),
    });
  };

  const finalizeTimeout = async (): Promise<void> => {
    if (resolved) return;
    resolved = true;
    disposeAll();
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    if (bet > 0) {
      balance = manager.AdjustBalance(interaction.user.id, bet, 0);
    }

    const refundLine =
      bet > 0
        ? `Bet refunded: **${bet}**`
        : "No bet was placed; nothing to refund.";

    const embed = EmbedFactory.CreateWarning({
      title: "⌛ Slots Timed Out",
      description: `Spin request expired. ${refundLine}\nBalance: **${balance}**`,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: [BuildDisabledSlotsButtons(customIds)],
      });
    } finally {
    }
  };

  const handleSpin = async (
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This spin is already finished.",
        ephemeral: true,
      });
      return;
    }

    resolved = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    disposeAll();

    const finalLeft = [spinReel(), spinReel(), spinReel()];
    const finalCenter = [spinReel(), spinReel(), spinReel()];
    const finalRight = [spinReel(), spinReel(), spinReel()];

    const buildFrame = (stopped: {
      left: boolean;
      center: boolean;
      right: boolean;
    }): string[] => {
      const leftCol = stopped.left
        ? finalLeft
        : [spinReel(), spinReel(), spinReel()];
      const centerCol = stopped.center
        ? finalCenter
        : [spinReel(), spinReel(), spinReel()];
      const rightCol = stopped.right
        ? finalRight
        : [spinReel(), spinReel(), spinReel()];

      return [
        leftCol[0],
        centerCol[0],
        rightCol[0],
        leftCol[1],
        centerCol[1],
        rightCol[1],
        leftCol[2],
        centerCol[2],
        rightCol[2],
      ];
    };

    const revealStates = [
      {
        grid: buildFrame({ left: false, center: false, right: false }),
        label: "Spinning...",
      },
      {
        grid: buildFrame({ left: false, center: false, right: false }),
        label: "Spinning faster...",
      },
      {
        grid: buildFrame({ left: true, center: false, right: false }),
        label: "Left reel stopped...",
      },
      {
        grid: buildFrame({ left: true, center: true, right: false }),
        label: "Center reel stopped...",
      },
    ];

    const finalGrid = [
      finalLeft[0],
      finalCenter[0],
      finalRight[0],
      finalLeft[1],
      finalCenter[1],
      finalRight[1],
      finalLeft[2],
      finalCenter[2],
      finalRight[2],
    ];

    await buttonResponder.Update(buttonInteraction, {
      embeds: [
        buildSpinEmbed(revealStates[0].grid, revealStates[0].label).toJSON(),
      ],
      components: [BuildDisabledSlotsButtons(customIds)],
    });

    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    await wait(400);
    await interaction.editReply({
      embeds: [
        buildSpinEmbed(revealStates[1].grid, revealStates[1].label).toJSON(),
      ],
      components: [BuildDisabledSlotsButtons(customIds)],
    });

    await wait(550);
    await interaction.editReply({
      embeds: [
        buildSpinEmbed(revealStates[2].grid, revealStates[2].label).toJSON(),
      ],
      components: [BuildDisabledSlotsButtons(customIds)],
    });

    await wait(650);
    const middleRow = [finalLeft[1], finalCenter[1], finalRight[1]];
    const { payout, outcome } = evaluateSpin(middleRow, bet);
    if (payout > 0) {
      balance = manager.AdjustBalance(interaction.user.id, payout, 0);
    }

    const xpOutcome: EconomyOutcome =
      payout > 0 ? "win" : bet > 0 ? "loss" : "neutral";
    AwardEconomyXp({
      interaction,
      context,
      bet,
      outcome: xpOutcome,
    });

    await interaction.editReply({
      embeds: [
        buildSpinEmbed(
          buildFrame({ left: true, center: true, right: true }),
          "Right reel stopped..."
        ).toJSON(),
      ],
      components: [BuildDisabledSlotsButtons(customIds)],
    });

    await wait(400);

    const resultEmbed = BuildSlotsResultEmbed({
      grid: finalGrid,
      bet,
      payout,
      balance,
      outcome,
    });

    await interaction.editReply({
      embeds: [resultEmbed.toJSON()],
      components: [BuildDisabledSlotsButtons(customIds)],
    });
  };

  const spinRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: SLOTS_TIMEOUT_MS,
    handler: (buttonInteraction) => handleSpin(buttonInteraction),
  });

  registrations.push(spinRegistration);
  customIds.spin = spinRegistration.customId;

  const promptEmbed = buildSpinEmbed(
    placeholder,
    "Press Spin to roll the reels."
  );

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [BuildSlotsButtons(customIds)],
    ephemeral: false,
  });

  if (!replyResult.success) {
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, bet, 0);
    }
    disposeAll();
    return;
  }

  timeoutHandle = setTimeout(() => {
    void finalizeTimeout();
  }, SLOTS_TIMEOUT_MS);
}



import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EconomyManager } from "@commands/fun/economy/EconomyManager";
import { BuildWheelResultEmbed } from "@commands/fun/economy/utils/Embeds";
import {
  BuildDisabledWheelButtons,
  BuildWheelButtons,
} from "@commands/fun/economy/utils/WheelComponents";
import {
  MAX_BET,
  MIN_BET,
  WHEEL_TIMEOUT_MS,
} from "@commands/fun/economy/constants";
import { EmbedFactory } from "@utilities";

type WheelSegment = {
  label: string;
  emoji: string;
  multiplier: number;
  weight: number;
};

const SEGMENTS: WheelSegment[] = [
  { label: "Common", emoji: "🟢", multiplier: 1.1, weight: 26 },
  { label: "Uncommon", emoji: "🔵", multiplier: 1.3, weight: 20 },
  { label: "Rare", emoji: "🟣", multiplier: 1.6, weight: 16 },
  { label: "Epic", emoji: "🟠", multiplier: 2.0, weight: 12 },
  { label: "Jackpot", emoji: "💎", multiplier: 3.5, weight: 8 },
  { label: "Mini-Bank", emoji: "⭐", multiplier: 2.5, weight: 10 },
  { label: "Miss", emoji: "⚫", multiplier: 0, weight: 5 },
  { label: "Half Back", emoji: "🟡", multiplier: 0.5, weight: 3 },
];

function renderWheel(currentIndex: number): string {
  const lines: string[] = [];
  for (let i = 0; i < SEGMENTS.length; i++) {
    const seg = SEGMENTS[i];
    const pointer = i === currentIndex ? "➡️" : "  ";
    lines.push(
      `${pointer} ${seg.emoji}  ${seg.label} (${seg.multiplier.toFixed(2)}x)`
    );
  }
  return lines.join("\n");
}

export async function HandleWheel(
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

  const buildWheelEmbed = (index: number, label: string) =>
    EmbedFactory.Create({
      title: "🎡 Prize Wheel",
      description: `${renderWheel(index)}\n\n${label}\n${
        bet > 0
          ? `Bet locked: **${bet}** | Balance after bet: **${balance}**`
          : "No bet placed."
      }`,
    });

  const finalizeTimeout = async (): Promise<void> => {
    if (resolved) return;
    resolved = true;
    disposeAll();
    if (timeoutHandle) clearTimeout(timeoutHandle);

    if (bet > 0) {
      balance = manager.AdjustBalance(interaction.user.id, bet, 0);
    }

    const refundLine =
      bet > 0
        ? `Bet refunded: **${bet}**`
        : "No bet was placed; nothing to refund.";

    const embed = EmbedFactory.CreateWarning({
      title: "⌛ Wheel Timed Out",
      description: `Spin request expired. ${refundLine}\nBalance: **${balance}**`,
    });

    try {
      await interaction.editReply({
        embeds: [embed.toJSON()],
        components: [BuildDisabledWheelButtons(customIds)],
      });
    } finally {
    }
  };

  const handleSpin = async (
    buttonInteraction: ButtonInteraction
  ): Promise<void> => {
    if (resolved) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This wheel spin already finished.",
        ephemeral: true,
      });
      return;
    }

    resolved = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    disposeAll();

    // Animation frames
    const ticks: number[] = [];
    const totalTicks = 14 + Math.floor(Math.random() * 6); // 14-19 ticks
    for (
      let i = 0, pos = Math.floor(Math.random() * SEGMENTS.length);
      i < totalTicks;
      i++
    ) {
      pos = (pos + 1) % SEGMENTS.length;
      ticks.push(pos);
    }

    await buttonResponder.Update(buttonInteraction, {
      embeds: [buildWheelEmbed(ticks[0], "Spinning...").toJSON()],
      components: [BuildDisabledWheelButtons(customIds)],
    });

    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    let delay = 140;
    for (let i = 1; i < ticks.length; i++) {
      delay += 20; // slow down over time
      await wait(delay);
      await interaction.editReply({
        embeds: [
          buildWheelEmbed(
            ticks[i],
            i >= ticks.length - 2 ? "Slowing..." : "Spinning..."
          ).toJSON(),
        ],
        components: [BuildDisabledWheelButtons(customIds)],
      });
    }

    const landedIndex = ticks[ticks.length - 1];
    const landed = SEGMENTS[landedIndex];
    const payout = bet > 0 ? Math.floor(bet * landed.multiplier) : 0;
    if (payout > 0) {
      balance = manager.AdjustBalance(interaction.user.id, payout, 0);
    }

    const resultEmbed = BuildWheelResultEmbed({
      segmentLabel: `${landed.emoji} ${landed.label}`,
      multiplier: landed.multiplier,
      bet,
      payout: bet > 0 ? payout : 0,
      balance,
    });

    await interaction.editReply({
      embeds: [resultEmbed.toJSON()],
      components: [BuildDisabledWheelButtons(customIds)],
    });
  };

  const spinRegistration = componentRouter.RegisterButton({
    ownerId: interaction.user.id,
    expiresInMs: WHEEL_TIMEOUT_MS,
    handler: (buttonInteraction) => handleSpin(buttonInteraction),
  });

  registrations.push(spinRegistration);
  customIds.spin = spinRegistration.customId;

  const promptEmbed = buildWheelEmbed(0, "Press Spin to start the wheel.");

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [BuildWheelButtons(customIds)],
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
  }, WHEEL_TIMEOUT_MS);
}



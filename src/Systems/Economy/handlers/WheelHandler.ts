import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { BuildWheelResultEmbed } from "@systems/Economy/utils/Embeds";
import {
  BuildDisabledWheelButtons,
  BuildWheelButtons,
} from "@systems/Economy/utils/WheelComponents";
import { WHEEL_TIMEOUT_MS } from "@systems/Economy/constants";
import { EmbedFactory } from "@utilities";
import type { EconomyOutcome } from "@systems/Economy/utils/EconomyXp";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import { PrepareWager } from "@systems/Economy/utils/Wager";
import { InteractiveSession } from "@shared/InteractiveSession";

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
      `${pointer} ${seg.emoji}  ${seg.label} (${seg.multiplier.toFixed(2)}x)`,
    );
  }
  return lines.join("\n");
}

export async function HandleWheel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;

  const prepared = await PrepareWager(interaction, context);
  if (!prepared) {
    return;
  }
  const { bet, manager } = prepared;
  let balance = prepared.balance;

  if (bet > 0) {
    balance = manager.AdjustBalance(interaction.user.id, -bet, 0);
  }

  const customIds = { spin: "" };

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
      void 0;
    }
  };

  const handleSpin = async (
    buttonInteraction: ButtonInteraction,
  ): Promise<void> => {
    if (!session.Resolve()) {
      await buttonResponder.Reply(buttonInteraction, {
        content: "This wheel spin already finished.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

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
            i >= ticks.length - 2 ? "Slowing..." : "Spinning...",
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

    const xpOutcome: EconomyOutcome =
      payout > 0 ? "win" : bet > 0 ? "loss" : "neutral";
    AwardEconomyXp({
      interaction,
      context,
      bet,
      outcome: xpOutcome,
    });

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

  const session = new InteractiveSession({
    componentRouter,
    ownerId: interaction.user.id,
    timeoutMs: WHEEL_TIMEOUT_MS,
    onTimeout: finalizeTimeout,
  });
  customIds.spin = session.RegisterButton(handleSpin);

  const promptEmbed = buildWheelEmbed(0, "Press Spin to start the wheel.");

  const replyResult = await interactionResponder.Reply(interaction, {
    embeds: [promptEmbed.toJSON()],
    components: [BuildWheelButtons(customIds)],
  });

  if (!replyResult.success) {
    if (bet > 0) {
      manager.AdjustBalance(interaction.user.id, bet, 0);
    }
    session.Resolve();
    return;
  }

  session.Start();
}

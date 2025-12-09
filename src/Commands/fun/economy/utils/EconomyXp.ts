import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { LevelManager } from "@commands/fun/leveling/LevelManager";

export type EconomyOutcome = "win" | "loss" | "neutral";

const ECONOMY_BASE_XP = 5;
const ECONOMY_BET_DIVISOR = 50; // +1 XP per 50 bet
const ECONOMY_BET_BONUS_CAP = 25; // cap bonus to keep things fair
const ECONOMY_WIN_MULTIPLIER = 1.5;
const ECONOMY_LOSS_MULTIPLIER = 0.5;
const ECONOMY_NEUTRAL_MULTIPLIER = 1.0;
const ECONOMY_DAILY_CAP = 1200; // generous daily cap to avoid frustration

type LedgerEntry = {
  day: number;
  earned: number;
};

const xpLedger = new Map<string, LedgerEntry>();

function GetDayKey(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function CalculateEconomyXp(bet: number, outcome: EconomyOutcome): number {
  const base = ECONOMY_BASE_XP;
  const bonus = Math.min(
    ECONOMY_BET_BONUS_CAP,
    Math.floor(Math.max(0, bet) / ECONOMY_BET_DIVISOR)
  );

  const multiplier =
    outcome === "win"
      ? ECONOMY_WIN_MULTIPLIER
      : outcome === "loss"
        ? ECONOMY_LOSS_MULTIPLIER
        : ECONOMY_NEUTRAL_MULTIPLIER;

  return Math.max(1, Math.floor((base + bonus) * multiplier));
}

export function AwardEconomyXp(options: {
  interaction: ChatInputCommandInteraction;
  context: CommandContext;
  bet?: number;
  outcome: EconomyOutcome;
}): number {
  const { interaction, context, bet = 0, outcome } = options;

  if (!interaction.guildId) {
    return 0;
  }

  const xp = CalculateEconomyXp(bet, outcome);
  const dayKey = GetDayKey();
  const ledgerKey = `${interaction.guildId}:${interaction.user.id}`;
  const current = xpLedger.get(ledgerKey);

  if (!current || current.day !== dayKey) {
    xpLedger.set(ledgerKey, { day: dayKey, earned: 0 });
  }

  const entry = xpLedger.get(ledgerKey)!;
  if (entry.earned >= ECONOMY_DAILY_CAP) {
    return 0;
  }

  const remaining = ECONOMY_DAILY_CAP - entry.earned;
  const toAward = Math.min(xp, remaining);

  if (toAward <= 0) {
    return 0;
  }

  const levelManager = new LevelManager(
    interaction.guildId,
    context.databases.userDb
  );
  levelManager.AddXp(interaction.user.id, toAward);

  entry.earned += toAward;
  xpLedger.set(ledgerKey, entry);

  return toAward;
}

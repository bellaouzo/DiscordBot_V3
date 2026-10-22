import { EmbedFactory } from "@utilities";
import type { FishCatch } from "../fishLogic";
import type { WorkTask } from "../workLogic";

type Embed = ReturnType<typeof EmbedFactory.Create>;

function Relative(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

export function BuildActivityCooldownEmbed(options: {
  activity: string;
  nextAvailableAt: number;
}): Embed {
  return EmbedFactory.CreateWarning({
    title: "⏳ Not Ready Yet",
    description: `You can ${options.activity} again ${Relative(options.nextAvailableAt)}.`,
  });
}

export function BuildWorkPromptEmbed(options: {
  task: WorkTask;
  rewardMin: number;
  rewardMax: number;
  timeoutMs: number;
}): Embed {
  return EmbedFactory.Create({
    title: `${options.task.emoji} Shift: ${options.task.job}`,
    description: [
      options.task.prompt,
      "",
      `Answer within ${Math.round(options.timeoutMs / 1000)}s. A correct answer pays **${options.rewardMin}-${options.rewardMax}** coins.`,
    ].join("\n"),
  });
}

export function BuildWorkResultEmbed(options: {
  task: WorkTask;
  correct: boolean;
  reward: number;
  balance: number;
  nextAvailableAt: number;
}): Embed {
  const footer = `Balance: **${options.balance}** · Next shift ${Relative(options.nextAvailableAt)}`;
  if (options.correct) {
    return EmbedFactory.CreateSuccess({
      title: `${options.task.emoji} Great Work!`,
      description: `${options.task.prompt}\n\nCorrect! You earned **${options.reward}** coins as a ${options.task.job}.\n${footer}`,
    });
  }
  return EmbedFactory.CreateWarning({
    title: `${options.task.emoji} Not Quite`,
    description: `${options.task.prompt}\n\nThe answer was **${options.task.options[options.task.correctIndex]}**. You still earned **${options.reward}** coins for showing up.\n${footer}`,
  });
}

export function BuildWorkTimeoutEmbed(task: WorkTask): Embed {
  return EmbedFactory.CreateWarning({
    title: "⌛ You Missed Your Shift",
    description: `${task.prompt}\n\nNo answer, no pay. Your shift is still available, so run \`/economy work\` again.`,
  });
}

export function BuildFishReadyEmbed(): Embed {
  return EmbedFactory.Create({
    title: "🎣 Gone Fishing",
    description:
      "Press **Cast** to throw your line, then press **Reel** as soon as something bites.\nReel too early and you'll scare the fish away!",
  });
}

export function BuildFishWaitingEmbed(): Embed {
  return EmbedFactory.Create({
    title: "🌊 Waiting for a Bite...",
    description: "Steady... don't reel in yet.",
  });
}

export function BuildFishBiteEmbed(): Embed {
  return EmbedFactory.CreateSuccess({
    title: "❗ Something's Biting!",
    description: "**Reel in now!**",
  });
}

export function BuildFishCaughtEmbed(options: {
  result: FishCatch;
  balance: number;
  nextAvailableAt: number;
}): Embed {
  const { fish, coins, perfect } = options.result;
  return EmbedFactory.CreateSuccess({
    title: `${fish.emoji} You Caught a ${fish.name}!`,
    description: [
      `+**${coins}** coins${perfect ? " (⚡ perfect reel bonus!)" : ""}`,
      `Balance: **${options.balance}** · Fish again ${Relative(options.nextAvailableAt)}`,
    ].join("\n"),
  });
}

export function BuildFishMissedEmbed(options: {
  early: boolean;
  nextAvailableAt: number;
}): Embed {
  return EmbedFactory.CreateWarning({
    title: options.early ? "💦 Too Early!" : "🐟 It Got Away",
    description: `${
      options.early
        ? "You reeled in before anything bit and scared the fish away."
        : "You weren't quick enough and the fish slipped off the hook."
    }\nFish again ${Relative(options.nextAvailableAt)}.`,
  });
}

export function BuildFishTimeoutEmbed(): Embed {
  return EmbedFactory.CreateWarning({
    title: "⌛ Line Never Cast",
    description:
      "You didn't cast in time. Your fishing spot is still available, so run `/economy fish` again.",
  });
}

import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { RequireGuild } from "@utilities";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import {
  FISH_BITE_MAX_MS,
  FISH_BITE_MIN_MS,
  FISH_COOLDOWN_MS,
  FISH_PERFECT_BONUS,
  FISH_PERFECT_REEL_MS,
  FISH_REEL_WINDOW_MS,
  FISH_TIMEOUT_MS,
} from "@systems/Economy/constants";
import {
  BuildActivityCooldownEmbed,
  BuildFishBiteEmbed,
  BuildFishCaughtEmbed,
  BuildFishMissedEmbed,
  BuildFishReadyEmbed,
  BuildFishTimeoutEmbed,
  BuildFishWaitingEmbed,
} from "@systems/Economy/utils/Embeds";
import {
  BuildFishCastButton,
  BuildFishReelButton,
} from "@systems/Economy/utils/ActivityComponents";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import { RollBiteDelay, RollCatch } from "@systems/Economy/utils/fishLogic";
import { InteractiveSession } from "@shared/InteractiveSession";

type FishPhase = "ready" | "waiting" | "bite" | "done";

/**
 * Fishing: press Cast, wait for a bite after a random delay, then press Reel within the
 * window. Reeling before the bite or missing the window catches nothing. The cast deadline
 * uses the session timeout; after casting, the bite and escape timers take over.
 */
export async function HandleFish(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, buttonResponder, componentRouter } =
    context.responders;
  const userId = interaction.user.id;
  const manager = new EconomyManager(
    RequireGuild(interaction).id,
    context.databases.userDb,
  );

  const claim = manager.ClaimActivity(userId, "fish", FISH_COOLDOWN_MS);
  if (!claim.success) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        BuildActivityCooldownEmbed({
          activity: "fish",
          nextAvailableAt: claim.nextAvailableAt,
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const nextAvailableAt = Date.now() + FISH_COOLDOWN_MS;
  const customIds = { cast: "", reel: "" };
  const timers: NodeJS.Timeout[] = [];
  let phase: FishPhase = "ready";
  let biteShownAt = 0;

  const clearTimers = (): void => {
    timers.splice(0).forEach((timer) => clearTimeout(timer));
  };

  const session = new InteractiveSession({
    componentRouter,
    ownerId: userId,
    timeoutMs: FISH_TIMEOUT_MS,
    onTimeout: async () => {
      phase = "done";
      manager.ReleaseActivity(userId, "fish");
      await interaction
        .editReply({
          embeds: [BuildFishTimeoutEmbed().toJSON()],
          components: [
            BuildFishCastButton({ castId: customIds.cast, disabled: true }),
          ],
        })
        .catch(() => undefined);
    },
  });

  const reelDone = () =>
    BuildFishReelButton({ reelId: customIds.reel, state: "done" });

  const handleEscape = async (): Promise<void> => {
    if (phase !== "bite" || !session.Resolve()) {
      return;
    }
    phase = "done";
    await interaction
      .editReply({
        embeds: [
          BuildFishMissedEmbed({ early: false, nextAvailableAt }).toJSON(),
        ],
        components: [reelDone()],
      })
      .catch(() => undefined);
  };

  const handleBite = async (): Promise<void> => {
    if (phase !== "waiting" || session.IsResolved) {
      return;
    }
    phase = "bite";
    await interaction
      .editReply({
        embeds: [BuildFishBiteEmbed().toJSON()],
        components: [
          BuildFishReelButton({ reelId: customIds.reel, state: "bite" }),
        ],
      })
      .catch(() => undefined);
    biteShownAt = Date.now();
    timers.push(setTimeout(() => void handleEscape(), FISH_REEL_WINDOW_MS));
  };

  const handleReel = async (button: ButtonInteraction): Promise<void> => {
    if (phase !== "waiting" && phase !== "bite") {
      await buttonResponder.Reply(button, {
        content: "This fishing trip already ended.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!session.Resolve()) {
      return;
    }
    clearTimers();

    if (phase === "waiting") {
      phase = "done";
      await buttonResponder.Update(button, {
        embeds: [
          BuildFishMissedEmbed({ early: true, nextAvailableAt }).toJSON(),
        ],
        components: [reelDone()],
      });
      return;
    }

    phase = "done";
    // The bite edit may still be in flight on a very fast press; count that as perfect.
    const reactionMs = biteShownAt > 0 ? Date.now() - biteShownAt : 0;
    const result = RollCatch({
      perfect: reactionMs <= FISH_PERFECT_REEL_MS,
      perfectBonus: FISH_PERFECT_BONUS,
    });
    const balance = manager.AdjustBalance(userId, result.coins);
    AwardEconomyXp({ interaction, context, outcome: "win" });

    await buttonResponder.Update(button, {
      embeds: [
        BuildFishCaughtEmbed({ result, balance, nextAvailableAt }).toJSON(),
      ],
      components: [reelDone()],
    });
  };

  const handleCast = async (button: ButtonInteraction): Promise<void> => {
    if (phase !== "ready" || session.IsResolved) {
      await buttonResponder.Reply(button, {
        content: "Your line is already in the water.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    phase = "waiting";
    session.StopTimer();
    // Registered now so the button's lifetime starts at the cast, not at the command.
    customIds.reel = session.RegisterButton(handleReel);

    await buttonResponder.Update(button, {
      embeds: [BuildFishWaitingEmbed().toJSON()],
      components: [
        BuildFishReelButton({ reelId: customIds.reel, state: "waiting" }),
      ],
    });

    const delay = RollBiteDelay(
      Math.random,
      FISH_BITE_MIN_MS,
      FISH_BITE_MAX_MS,
    );
    timers.push(setTimeout(() => void handleBite(), delay));
  };

  customIds.cast = session.RegisterButton(handleCast);

  const reply = await interactionResponder.Reply(interaction, {
    embeds: [BuildFishReadyEmbed().toJSON()],
    components: [BuildFishCastButton({ castId: customIds.cast })],
  });

  if (!reply.success) {
    manager.ReleaseActivity(userId, "fish");
    session.Resolve();
    return;
  }

  session.Start();
}

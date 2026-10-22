import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { RequireGuild } from "@utilities";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import {
  WORK_CONSOLATION_REWARD,
  WORK_COOLDOWN_MS,
  WORK_REWARD_MAX,
  WORK_REWARD_MIN,
  WORK_TIMEOUT_MS,
} from "@systems/Economy/constants";
import {
  BuildActivityCooldownEmbed,
  BuildWorkPromptEmbed,
  BuildWorkResultEmbed,
  BuildWorkTimeoutEmbed,
} from "@systems/Economy/utils/Embeds";
import { BuildWorkButtons } from "@systems/Economy/utils/ActivityComponents";
import { AwardEconomyXp } from "@systems/Economy/utils/EconomyXp";
import {
  GenerateWorkTask,
  RollWorkReward,
} from "@systems/Economy/utils/workLogic";
import { InteractiveSession } from "@shared/InteractiveSession";

export async function HandleWork(
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

  const claim = manager.ClaimActivity(userId, "work", WORK_COOLDOWN_MS);
  if (!claim.success) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        BuildActivityCooldownEmbed({
          activity: "work",
          nextAvailableAt: claim.nextAvailableAt,
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const startedAt = Date.now();
  const task = GenerateWorkTask();
  const customIds: string[] = [];

  const session = new InteractiveSession({
    componentRouter,
    ownerId: userId,
    timeoutMs: WORK_TIMEOUT_MS,
    onTimeout: async () => {
      manager.ReleaseActivity(userId, "work");
      await interaction
        .editReply({
          embeds: [BuildWorkTimeoutEmbed(task).toJSON()],
          components: [
            BuildWorkButtons({
              customIds,
              labels: task.options,
              answered: { chosenIndex: -1, correctIndex: task.correctIndex },
            }),
          ],
        })
        .catch(() => undefined);
    },
  });

  const handleAnswer = async (
    button: ButtonInteraction,
    chosenIndex: number,
  ): Promise<void> => {
    if (!session.Resolve()) {
      await buttonResponder.Reply(button, {
        content: "This shift already ended.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const correct = chosenIndex === task.correctIndex;
    const reward = correct
      ? RollWorkReward(Math.random, WORK_REWARD_MIN, WORK_REWARD_MAX)
      : WORK_CONSOLATION_REWARD;
    const balance = manager.AdjustBalance(userId, reward);
    AwardEconomyXp({
      interaction,
      context,
      outcome: correct ? "win" : "neutral",
    });

    await buttonResponder.Update(button, {
      embeds: [
        BuildWorkResultEmbed({
          task,
          correct,
          reward,
          balance,
          nextAvailableAt: startedAt + WORK_COOLDOWN_MS,
        }).toJSON(),
      ],
      components: [
        BuildWorkButtons({
          customIds,
          labels: task.options,
          answered: { chosenIndex, correctIndex: task.correctIndex },
        }),
      ],
    });
  };

  task.options.forEach((_, index) => {
    customIds.push(
      session.RegisterButton((button) => handleAnswer(button, index)),
    );
  });

  const reply = await interactionResponder.Reply(interaction, {
    embeds: [
      BuildWorkPromptEmbed({
        task,
        rewardMin: WORK_REWARD_MIN,
        rewardMax: WORK_REWARD_MAX,
        timeoutMs: WORK_TIMEOUT_MS,
      }).toJSON(),
    ],
    components: [BuildWorkButtons({ customIds, labels: task.options })],
  });

  if (!reply.success) {
    manager.ReleaseActivity(userId, "work");
    session.Resolve();
    return;
  }

  session.Start();
}

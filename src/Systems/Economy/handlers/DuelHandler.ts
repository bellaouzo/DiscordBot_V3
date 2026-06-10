import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { EconomyManager } from "@systems/Economy/EconomyManager";
import {
  DUEL_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
} from "@systems/Economy/constants";
import type { DuelGame } from "@database/User/Stores/DuelStore";
import type { FlipChoice, RpsChoice } from "@systems/Economy/types";
import { DetermineRpsOutcome } from "@systems/Economy/utils/rpsLogic";
import {
  FlipCoin,
  OppositeFlipChoice,
} from "@systems/Economy/utils/flipLogic";
import { EmbedFactory, RequireGuild } from "@utilities";

const duelRpsChoices = new Map<
  number,
  { challenger?: RpsChoice; opponent?: RpsChoice }
>();

function BuildChallengeButtons(duelId: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`duel_accept_${duelId}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`duel_decline_${duelId}`)
      .setLabel("Decline")
      .setStyle(ButtonStyle.Danger),
  );
}

async function ResolveDuelPayout(
  manager: EconomyManager,
  duel: {
    id: number;
    challenger_id: string;
    opponent_id: string;
    bet: number;
  },
  winnerId: string | null,
): Promise<void> {
  if (winnerId === null) {
    manager.AdjustBalance(duel.challenger_id, duel.bet);
    manager.AdjustBalance(duel.opponent_id, duel.bet);
    return;
  }

  manager.AdjustBalance(winnerId, duel.bet * 2);
}

export async function HandleDuelChallenge(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder, componentRouter, buttonResponder } =
    context.responders;
  const guild = RequireGuild(interaction);
  const opponent = interaction.options.getUser("user", true);
  const bet = interaction.options.getInteger("bet", true);
  const game = interaction.options.getString("game", true) as DuelGame;

  if (opponent.id === interaction.user.id) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Invalid Opponent",
          description: "You cannot duel yourself.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (opponent.bot) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Invalid Opponent",
          description: "You cannot duel bots.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (bet < MIN_BET || bet > MAX_BET) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Invalid Bet",
          description: `Bet must be between ${MIN_BET} and ${MAX_BET}.`,
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const manager = new EconomyManager(guild.id, context.databases.userDb);
  const challengerBalance = manager.EnsureBalance(interaction.user.id);
  const opponentBalance = manager.EnsureBalance(opponent.id);

  if (challengerBalance < bet || opponentBalance < bet) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Insufficient Balance",
          description: "Both players need enough coins to cover the bet.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.channel?.isTextBased()) {
    await interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Invalid Channel",
          description: "Duels must be started in a text channel.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const challengeEmbed = EmbedFactory.Create({
    title: "⚔️ Duel Challenge",
    description: [
      `<@${interaction.user.id}> challenged <@${opponent.id}>!`,
      `**Game:** ${game}`,
      `**Bet:** ${bet} coins each`,
      `**Pot:** ${bet * 2} coins`,
    ].join("\n"),
    color: 0xe67e22,
  });

  const placeholder = await (interaction.channel as TextChannel).send({
    embeds: [challengeEmbed.toJSON()],
    components: [BuildChallengeButtons(0)],
  });

  const duel = context.databases.userDb.CreateDuel({
    guild_id: guild.id,
    channel_id: interaction.channel.id,
    message_id: placeholder.id,
    challenger_id: interaction.user.id,
    opponent_id: opponent.id,
    bet,
    game,
    expires_at: Date.now() + DUEL_TIMEOUT_MS,
  });

  await placeholder.edit({
    embeds: [challengeEmbed.toJSON()],
    components: [BuildChallengeButtons(duel.id)],
  });

  const startActiveDuel = async (
    buttonInteraction: ButtonInteraction,
    duelRecord: NonNullable<
      ReturnType<typeof context.databases.userDb.GetDuelById>
    >,
  ): Promise<void> => {
    if (duelRecord.game === "flip") {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`duel_flip_heads_${duelRecord.id}`)
          .setLabel("Heads")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`duel_flip_tails_${duelRecord.id}`)
          .setLabel("Tails")
          .setStyle(ButtonStyle.Secondary),
      );

      const embed = EmbedFactory.Create({
        title: "Coinflip Duel",
        description: `<@${duelRecord.challenger_id}>, pick heads or tails.`,
        color: 0xe67e22,
      });

      await buttonInteraction.message.edit({
        embeds: [embed.toJSON()],
        components: [row],
      });

      const resolveFlip = async (
        pickInteraction: ButtonInteraction,
        choice: FlipChoice,
      ): Promise<void> => {
        if (pickInteraction.user.id !== duelRecord.challenger_id) {
          await buttonResponder.Reply(pickInteraction, {
            content: "Only the challenger picks first in coinflip duels.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const flipResult = FlipCoin();
        const opponentChoice = OppositeFlipChoice(choice);
        const challengerWins = flipResult === choice;
        const opponentWins = flipResult === opponentChoice;
        const winnerId = challengerWins
          ? duelRecord.challenger_id
          : opponentWins
            ? duelRecord.opponent_id
            : null;

        await ResolveDuelPayout(manager, duelRecord, winnerId);
        context.databases.userDb.CompleteDuel(duelRecord.id, winnerId);

        const resultEmbed = EmbedFactory.Create({
          title: "Coinflip Duel Result",
          description: [
            `Result: **${flipResult}**`,
            `Challenger picked **${choice}**, opponent had **${opponentChoice}**`,
            winnerId
              ? `Winner: <@${winnerId}> (+${duelRecord.bet} net)`
              : "Draw — bets refunded.",
          ].join("\n"),
          color: winnerId ? 0x57f287 : 0xfee75c,
        });

        await pickInteraction.message.edit({
          embeds: [resultEmbed.toJSON()],
          components: [],
        });
        await buttonResponder.DeferUpdate(pickInteraction);
      };

      componentRouter.RegisterButton({
        customId: `duel_flip_heads_${duelRecord.id}`,
        expiresInMs: DUEL_TIMEOUT_MS,
        handler: (pickInteraction) => resolveFlip(pickInteraction, "heads"),
      });
      componentRouter.RegisterButton({
        customId: `duel_flip_tails_${duelRecord.id}`,
        expiresInMs: DUEL_TIMEOUT_MS,
        handler: (pickInteraction) => resolveFlip(pickInteraction, "tails"),
      });

      await buttonResponder.Reply(buttonInteraction, {
        content: "Duel accepted. Waiting for challenger to pick.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    duelRpsChoices.set(duelRecord.id, {});
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`duel_rps_rock_${duelRecord.id}`)
        .setLabel("Rock")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`duel_rps_paper_${duelRecord.id}`)
        .setLabel("Paper")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`duel_rps_scissors_${duelRecord.id}`)
        .setLabel("Scissors")
        .setStyle(ButtonStyle.Primary),
    );

    const embed = EmbedFactory.Create({
      title: "RPS Duel",
      description: "Both players pick rock, paper, or scissors.",
      color: 0xe67e22,
    });

    await buttonInteraction.message.edit({
      embeds: [embed.toJSON()],
      components: [row],
    });

    const resolveRps = async (
      pickInteraction: ButtonInteraction,
      choice: RpsChoice,
    ): Promise<void> => {
      const current = context.databases.userDb.GetDuelById(duelRecord.id);
      if (!current || current.status !== "active") {
        await buttonResponder.Reply(pickInteraction, {
          content: "This duel is no longer active.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const state = duelRpsChoices.get(duelRecord.id) ?? {};
      if (pickInteraction.user.id === current.challenger_id) {
        state.challenger = choice;
      } else if (pickInteraction.user.id === current.opponent_id) {
        state.opponent = choice;
      } else {
        await buttonResponder.Reply(pickInteraction, {
          content: "Only duel participants can pick.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      duelRpsChoices.set(duelRecord.id, state);

      if (!state.challenger || !state.opponent) {
        await buttonResponder.Reply(pickInteraction, {
          content: `You picked **${choice}**. Waiting for the other player.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const outcome = DetermineRpsOutcome(state.challenger, state.opponent);
      const winnerId =
        outcome === "draw"
          ? null
          : outcome === "win"
            ? current.challenger_id
            : current.opponent_id;

      await ResolveDuelPayout(manager, current, winnerId);
      context.databases.userDb.CompleteDuel(current.id, winnerId);
      duelRpsChoices.delete(duelRecord.id);

      const resultEmbed = EmbedFactory.Create({
        title: "RPS Duel Result",
        description: [
          `<@${current.challenger_id}> picked **${state.challenger}**`,
          `<@${current.opponent_id}> picked **${state.opponent}**`,
          winnerId
            ? `Winner: <@${winnerId}> (+${current.bet} net)`
            : "Draw — bets refunded.",
        ].join("\n"),
        color: winnerId ? 0x57f287 : 0xfee75c,
      });

      await pickInteraction.message.edit({
        embeds: [resultEmbed.toJSON()],
        components: [],
      });
      await buttonResponder.DeferUpdate(pickInteraction);
    };

    for (const choice of ["rock", "paper", "scissors"] as RpsChoice[]) {
      componentRouter.RegisterButton({
        customId: `duel_rps_${choice}_${duelRecord.id}`,
        expiresInMs: DUEL_TIMEOUT_MS,
        handler: (pickInteraction) => resolveRps(pickInteraction, choice),
      });
    }

    await buttonResponder.Reply(buttonInteraction, {
      content: "Duel accepted. Pick your move.",
      flags: MessageFlags.Ephemeral,
    });
  };

  const registerAcceptDecline = (duelId: number): void => {
    const dispose: Array<() => void> = [];

    const acceptId = `duel_accept_${duelId}`;
    const declineId = `duel_decline_${duelId}`;

    const acceptRegistration = componentRouter.RegisterButton({
        customId: acceptId,
        expiresInMs: DUEL_TIMEOUT_MS,
        handler: async (buttonInteraction: ButtonInteraction) => {
          const current = context.databases.userDb.GetDuelById(duelId);
          if (!current || current.status !== "pending") {
            await buttonResponder.Reply(buttonInteraction, {
              content: "This duel is no longer available.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (buttonInteraction.user.id !== current.opponent_id) {
            await buttonResponder.Reply(buttonInteraction, {
              content: "Only the challenged player can accept.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (!context.databases.userDb.ActivateDuel(duelId)) {
            await buttonResponder.Reply(buttonInteraction, {
              content: "This duel was already handled.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const challengerBalanceNow = manager.EnsureBalance(
            current.challenger_id,
          );
          const opponentBalanceNow = manager.EnsureBalance(current.opponent_id);
          if (
            challengerBalanceNow < current.bet ||
            opponentBalanceNow < current.bet
          ) {
            context.databases.userDb.CancelDuel(duelId);
            await buttonResponder.Reply(buttonInteraction, {
              content: "One player no longer has enough coins.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          manager.AdjustBalance(current.challenger_id, -current.bet);
          manager.AdjustBalance(current.opponent_id, -current.bet);

          dispose.forEach((fn) => fn());
          await startActiveDuel(buttonInteraction, current);
        },
      });
    dispose.push(acceptRegistration.dispose);

    const declineRegistration = componentRouter.RegisterButton({
        customId: declineId,
        expiresInMs: DUEL_TIMEOUT_MS,
        handler: async (buttonInteraction: ButtonInteraction) => {
          const current = context.databases.userDb.GetDuelById(duelId);
          if (!current || current.status !== "pending") {
            await buttonResponder.Reply(buttonInteraction, {
              content: "This duel is no longer available.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (
            buttonInteraction.user.id !== current.opponent_id &&
            buttonInteraction.user.id !== current.challenger_id
          ) {
            await buttonResponder.Reply(buttonInteraction, {
              content: "Only the duel participants can decline.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          context.databases.userDb.CancelDuel(duelId);
          dispose.forEach((fn) => fn());

          const embed = EmbedFactory.CreateWarning({
            title: "Duel Declined",
            description: "The duel was declined.",
          });
          await buttonInteraction.message.edit({
            embeds: [embed.toJSON()],
            components: [],
          });
          await buttonResponder.Reply(buttonInteraction, {
            content: "Duel declined.",
            flags: MessageFlags.Ephemeral,
          });
        },
      });
    dispose.push(declineRegistration.dispose);
  };

  registerAcceptDecline(duel.id);

  await interactionResponder.Reply(interaction, {
    embeds: [
      EmbedFactory.CreateSuccess({
        title: "Challenge Sent",
        description: `Duel challenge posted for <@${opponent.id}>.`,
      }).toJSON(),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

export async function HandleDuelCancel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const pending = context.databases.userDb.ListPendingDuelsByChallenger(
    guild.id,
    interaction.user.id,
  );

  if (pending.length === 0) {
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "No Pending Duels",
          description: "You have no pending duel challenges to cancel.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const duel = pending[0];
  context.databases.userDb.CancelDuel(duel.id);

  try {
    const channel = await interaction.client.channels.fetch(duel.channel_id);
    if (channel?.isTextBased()) {
      const message = await (channel as TextChannel).messages.fetch(
        duel.message_id,
      );
      await message.edit({
        embeds: [
          EmbedFactory.CreateWarning({
            title: "Duel Cancelled",
            description: "The challenger cancelled this duel.",
          }).toJSON(),
        ],
        components: [],
      });
    }
  } catch (error) {
    context.logger.Warn("Failed to update cancelled duel message", { error });
  }

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [
      EmbedFactory.CreateSuccess({
        title: "Duel Cancelled",
        description: `Cancelled duel #${duel.id}.`,
      }).toJSON(),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

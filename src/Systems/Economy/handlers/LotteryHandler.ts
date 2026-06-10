import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import { LotteryManager } from "@systems/Economy/LotteryManager";
import { RegisterLotteryEntryHandler } from "@systems/Economy/LotteryEntryHandler";
import {
  LOTTERY_MAX_ENTRY_COST,
  LOTTERY_MIN_ENTRY_COST,
} from "@systems/Economy/constants";
import {
  EmbedFactory,
  IsModerator,
  ParseDuration,
  RequireGuild,
  ResolveInteractionMember,
} from "@utilities";

export async function HandleLotteryCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const member = await ResolveInteractionMember(interaction);

  if (!IsModerator(member, settings)) {
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Permission Denied",
          description: "Only moderators can create lotteries.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.channel?.isTextBased()) {
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateError({
          title: "Invalid Channel",
          description: "Lotteries can only be created in text channels.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const entryCost = interaction.options.getInteger("entry-cost", true);
  const durationInput = interaction.options.getString("duration", true);
  const durationMs = ParseDuration(durationInput);

  if (
    entryCost < LOTTERY_MIN_ENTRY_COST ||
    entryCost > LOTTERY_MAX_ENTRY_COST
  ) {
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Invalid Entry Cost",
          description: `Entry cost must be between ${LOTTERY_MIN_ENTRY_COST} and ${LOTTERY_MAX_ENTRY_COST}.`,
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!durationMs || durationMs < 60_000) {
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "Invalid Duration",
          description: "Duration must be at least 1 minute (e.g. `30m`, `2h`).",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await context.responders.interactionResponder.Defer(interaction, true);

  const endsAt = Date.now() + durationMs;
  const channel = interaction.channel as TextChannel;
  const manager = new LotteryManager(guild.id, context.databases.userDb);

  const tempId = Date.now();
  const { embed, row } = manager.CreateLotteryMessage({
    entryCost,
    endsAt,
    hostId: interaction.user.id,
    pot: 0,
    entryCount: 0,
    lotteryId: tempId,
  });

  const message = await channel.send({
    embeds: [embed.toJSON()],
    components: [row],
  });

  const lottery = context.databases.userDb.CreateLottery({
    guild_id: guild.id,
    channel_id: channel.id,
    message_id: message.id,
    host_id: interaction.user.id,
    entry_cost: entryCost,
    ends_at: endsAt,
  });

  const { embed: savedEmbed, row: savedRow } = manager.CreateLotteryMessage({
    entryCost,
    endsAt,
    hostId: interaction.user.id,
    pot: 0,
    entryCount: 0,
    lotteryId: lottery.id,
  });
  await message.edit({
    embeds: [savedEmbed.toJSON()],
    components: [savedRow],
  });
  RegisterLotteryEntryHandler({
    lotteryId: lottery.id,
    expiresInMs: durationMs + 60_000,
    manager,
    channel,
    lotteryMessageId: message.id,
    context,
  });

  await context.responders.interactionResponder.Edit(interaction, {
    embeds: [
      EmbedFactory.CreateSuccess({
        title: "Lottery Created",
        description: [
          `**Entry Cost:** ${entryCost} coins`,
          `**Ends:** <t:${Math.floor(endsAt / 1000)}:R>`,
          `[Jump to Lottery](${message.url})`,
        ].join("\n"),
      }).toJSON(),
    ],
  });
}

export async function HandleLotteryList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const lotteries = context.databases.userDb.GetActiveLotteries(guild.id);

  if (lotteries.length === 0) {
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: [
        EmbedFactory.CreateWarning({
          title: "No Active Lotteries",
          description: "There are no active lotteries in this server.",
        }).toJSON(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = EmbedFactory.Create({
    title: "Active Lotteries",
    description: lotteries
      .map(
        (lottery) =>
          `**#${lottery.id}** — ${lottery.entry_cost} coins/entry, pot ${lottery.pot}, ends <t:${Math.floor(lottery.ends_at / 1000)}:R>`,
      )
      .join("\n"),
  });

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

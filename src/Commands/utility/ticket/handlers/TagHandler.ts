import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import {
  CreateTicketServices,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
} from "@commands/utility/ticket/validation/TicketValidation";
import { EmbedFactory } from "@utilities";

type TagAction = "add" | "remove" | "list";

function NormalizeTag(tag: string | null): string {
  return (tag ?? "").trim().toLowerCase();
}

export async function HandleTicketTag(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (
    !(await ValidateTicketChannelOrReply(interaction, interactionResponder))
  ) {
    return;
  }

  const { logger } = context;
  const { ticketDb } = CreateTicketServices(logger, interaction.guild!);

  const channel = interaction.channel as TextChannel;
  const ticket = await GetTicketOrReply(
    ticketDb,
    channel as never,
    interaction,
    interactionResponder
  );

  if (!ticket) {
    return;
  }

  const action = (interaction.options.getString("action", true) ??
    "add") as TagAction;
  const tagInput = NormalizeTag(interaction.options.getString("tag", false));

  if (action !== "list" && !tagInput) {
    const embed = EmbedFactory.CreateError({
      title: "Tag Required",
      description: "Provide a tag to add or remove.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (action === "list") {
    const tags = ticketDb.ListTicketTags(ticket.id);
    const embed = EmbedFactory.Create({
      title: `🏷️ Ticket #${ticket.id} Tags`,
      description:
        tags.length > 0 ? tags.join(", ") : "This ticket has no tags.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (action === "add") {
    const added = ticketDb.AddTicketTag(ticket.id, tagInput);
    const embed = added
      ? EmbedFactory.CreateSuccess({
          title: "Tag Added",
          description: `Added tag \`${tagInput}\` to ticket #${ticket.id}.`,
        })
      : EmbedFactory.CreateWarning({
          title: "Not Added",
          description: `Tag \`${tagInput}\` already exists or is invalid.`,
        });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  if (action === "remove") {
    const removed = ticketDb.RemoveTicketTag(ticket.id, tagInput);
    const embed = removed
      ? EmbedFactory.CreateSuccess({
          title: "Tag Removed",
          description: `Removed tag \`${tagInput}\` from ticket #${ticket.id}.`,
        })
      : EmbedFactory.CreateWarning({
          title: "Not Found",
          description: `Tag \`${tagInput}\` was not on this ticket.`,
        });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
  }
}

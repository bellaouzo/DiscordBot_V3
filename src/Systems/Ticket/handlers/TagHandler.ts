import {
  ChatInputCommandInteraction,
  TextChannel,
  MessageFlags,
} from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import {
  CreateTicketServices,
  HasStaffPermissions,
  ValidateTicketChannelOrReply,
  GetTicketOrReply,
} from "@systems/Ticket/validation/TicketValidation";
import { EmbedFactory, ResolveInteractionMember } from "@utilities";

type TagAction = "add" | "remove" | "list";

function NormalizeTag(tag: string | null): string {
  return (tag ?? "").trim().toLowerCase();
}

export async function HandleTicketTag(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (
    !(await ValidateTicketChannelOrReply(interaction, interactionResponder))
  ) {
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild!.id,
  );
  const member = await ResolveInteractionMember(interaction);

  if (
    !HasStaffPermissions(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You need staff permissions to manage ticket tags.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { logger } = context;
  const { ticketDb, ticketPresentation } = CreateTicketServices(
    logger,
    interaction.guild!,
    context.databases.ticketDb,
    context.databases.serverDb,
  );

  const channel = interaction.channel as TextChannel;
  const ticket = await GetTicketOrReply(
    ticketDb,
    channel as never,
    interaction,
    interactionResponder,
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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "list") {
    const tags = ticketDb.ListTicketTags(ticket.id);
    const embed = EmbedFactory.Create({
      title: `🏷️ Ticket #${ticket.id} Tags`,
      description:
        tags.length > 0
          ? tags.map((tag) => `\`${tag}\``).join(", ")
          : "This ticket has no tags.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });

    if (added) {
      await ticketPresentation.SyncTicketChannelEmbed(ticket);
    }
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
      flags: MessageFlags.Ephemeral,
    });

    if (removed) {
      await ticketPresentation.SyncTicketChannelEmbed(ticket);
    }
  }
}

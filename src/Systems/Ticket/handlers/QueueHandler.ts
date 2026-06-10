import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandContext } from "@commands/CommandFactory";
import { EmbedFactory, ResolveInteractionMember } from "@utilities";
import {
  CreateTicketServices,
  HasStaffPermissions,
  ValidateGuildOrReply,
} from "@systems/Ticket/validation/TicketValidation";

export async function HandleTicketQueue(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;
  const { logger } = context;

  if (!(await ValidateGuildOrReply(interaction, interactionResponder))) {
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
      description: "You need staff permissions to view the ticket queue.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { ticketDb } = CreateTicketServices(
    logger,
    interaction.guild!,
    context.databases.ticketDb,
    context.databases.serverDb,
  );

  const openTickets = ticketDb.GetGuildTickets(interaction.guild!.id, "open");
  const claimedTickets = ticketDb.GetGuildTickets(
    interaction.guild!.id,
    "claimed",
  );
  const activeTickets = [...openTickets, ...claimedTickets].sort(
    (a, b) => a.created_at - b.created_at,
  );

  const categories = ticketDb.EnsureCategoryConfigs(interaction.guild!.id);
  const tagMap = ticketDb.GetTagsForTickets(
    activeTickets.map((ticket) => ticket.id),
  );

  const embed = EmbedFactory.Create({
    title: "🎫 Ticket Queue",
    description:
      activeTickets.length === 0
        ? "No open tickets in the queue."
        : `**${activeTickets.length}** active ticket${
            activeTickets.length !== 1 ? "s" : ""
          } awaiting staff attention.`,
    color: 0x5865f2,
  });

  if (activeTickets.length > 0) {
    const lines = activeTickets.slice(0, 15).map((ticket) => {
      const category = categories.find((c) => c.value === ticket.category);
      const categoryLabel = category
        ? `${category.emoji} ${category.label}`
        : ticket.category;
      const statusEmoji = ticket.status === "claimed" ? "📌" : "📝";
      const channelLink = ticket.channel_id
        ? `<#${ticket.channel_id}>`
        : "No channel";
      const claimInfo = ticket.claimed_by
        ? ` — claimed by <@${ticket.claimed_by}>`
        : "";
      const tags = tagMap[ticket.id] ?? [];
      const tagInfo =
        tags.length > 0
          ? ` — tags: ${tags.map((tag) => `\`${tag}\``).join(", ")}`
          : "";
      return `${statusEmoji} **#${ticket.id}** ${categoryLabel} — ${channelLink} — <@${ticket.user_id}>${claimInfo}${tagInfo}`;
    });

    embed.addFields({
      name: "Active Tickets",
      value: lines.join("\n"),
      inline: false,
    });
  }

  await interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

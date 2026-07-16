import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { ButtonStyle, MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import {
  ComponentFactory,
  EmbedFactory,
  ToActionRowData,
  IsTicketStaff,
  ResolveInteractionMember,
} from "@utilities";
import { BeginTicketCreation } from "@systems/Ticket/handlers/CreateHandler";

export const PANEL_BUTTON_CUSTOM_ID = "ticket-panel:create";

export async function PostTicketPanelToChannel(
  channel: TextChannel,
): Promise<void> {
  const embed = EmbedFactory.Create({
    title: "Support Tickets",
    description:
      "Need help? Open a private support ticket and our staff will assist you.\n\n" +
      "1. Click **Open Ticket** below\n" +
      "2. Choose a category for your issue\n" +
      "3. Describe your problem in the ticket channel\n\n" +
      "Use `/ticket list` to view your existing tickets.\n" +
      "Manage open tickets with the buttons inside your ticket channel.",
    color: 0x5865f2,
  });

  const row = ComponentFactory.CreateActionRow({
    buttons: [
      {
        label: "Open Ticket",
        style: ButtonStyle.Primary,
        emoji: "🎫",
      },
    ],
    customIds: [PANEL_BUTTON_CUSTOM_ID],
  });

  await channel.send({
    embeds: [embed.toJSON()],
    components: [ToActionRowData(row)],
  });
}

export function RegisterTicketPanelButton(context: CommandContext): void {
  const { componentRouter, buttonResponder } = context.responders;

  componentRouter.RegisterButton({
    customId: PANEL_BUTTON_CUSTOM_ID,
    handler: async (buttonInteraction) => {
      const guild = buttonInteraction.guild;
      if (!guild) {
        await buttonResponder.Reply(buttonInteraction, {
          content: "Tickets can only be opened inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

      await BeginTicketCreation({
        context,
        guild,
        userId: buttonInteraction.user.id,
        sourceInteractionId: buttonInteraction.id,
        deferReply: async () => {},
        editReply: async (payload) => {
          await buttonInteraction.editReply({
            embeds: payload.embeds,
            components: payload.components,
          });
        },
      });
    },
  });
}

export async function HandleTicketPanel(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const { interactionResponder } = context.responders;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Ticket panels can only be posted inside a server.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id,
  );
  const member = await ResolveInteractionMember(interaction);

  if (
    !IsTicketStaff(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    })
  ) {
    const embed = EmbedFactory.CreateError({
      title: "Permission Denied",
      description: "You do not have permission to post ticket panels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    const embed = EmbedFactory.CreateError({
      title: "Invalid Channel",
      description: "Ticket panels can only be posted in server text channels.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  RegisterTicketPanelButton(context);

  await PostTicketPanelToChannel(channel as TextChannel);

  const confirmEmbed = EmbedFactory.CreateSuccess({
    title: "Ticket Panel Posted",
    description: `The ticket panel was posted in ${channel}.`,
  });
  await interactionResponder.Reply(interaction, {
    embeds: [confirmEmbed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

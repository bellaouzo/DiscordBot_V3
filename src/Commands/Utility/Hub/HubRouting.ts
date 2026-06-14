import type { ButtonInteraction, Guild } from "discord.js";
import { MessageFlags } from "discord.js";
import type { CommandContext } from "@commands";
import type { ButtonResponder } from "@responders";
import {
  BuildCategoryViews,
  GetAllCommandsCached,
} from "@commands/Utility/Help/HelpCatalog";
import { BuildFeatureCategoryView } from "@commands/Utility/Help/FeatureHelpCatalog";
import { CreateOverviewPayload } from "@commands/Utility/Help/HelpComponents";
import { RegisterHelpButtons } from "@commands/Utility/Help/HelpRouting";
import { BeginAppealSubmission } from "@commands/Moderation/Appeal/AppealSubmitFlow";
import { BuildAppealListPages } from "@commands/Moderation/Appeal/AppealFormatters";
import {
  CreateAppealManager,
  EmbedFactory,
  IsModerator,
} from "@utilities";
import { BeginTicketCreation } from "@systems/Ticket/handlers/CreateHandler";
import { CreateTicketServices } from "@systems/Ticket/validation/TicketValidation";
import { VerifyGuildMember } from "@systems/Verification/VerifyMember";
import { BuildVerificationSuccessEmbed } from "@systems/Verification/VerificationPanelPresentation";
import {
  BuildHubPayload,
  BuildHubStatsEmbed,
  type HubContext,
} from "@commands/Utility/Hub/HubComponents";
import {
  CreateHubActionCustomId,
  HUB_SESSION_TIMEOUT_MS,
  type HubAction,
} from "@commands/Utility/Hub/HubTypes";

export function RegisterHubButtons(options: {
  readonly context: CommandContext;
  readonly hub: HubContext;
  readonly componentRouter: CommandContext["responders"]["componentRouter"];
  readonly buttonResponder: ButtonResponder;
}): void {
  const { context, hub, componentRouter, buttonResponder } = options;
  const actions: HubAction[] = [
    "home",
    "ticket",
    "help",
    "stats",
    "appeal",
    "verify",
    "staff-tickets",
    "staff-appeals",
    "staff-commands",
  ];

  actions.forEach((action) => {
    componentRouter.RegisterButton({
      customId: CreateHubActionCustomId(hub.interactionId, action),
      ownerId: hub.member.id,
      expiresInMs: HUB_SESSION_TIMEOUT_MS,
      handler: async (buttonInteraction) => {
        await HandleHubAction({
          action,
          buttonInteraction,
          context,
          hub,
          buttonResponder,
        });
      },
    });
  });
}

async function HandleHubAction(options: {
  readonly action: HubAction;
  readonly buttonInteraction: ButtonInteraction;
  readonly context: CommandContext;
  readonly hub: HubContext;
  readonly buttonResponder: ButtonResponder;
}): Promise<void> {
  const { action, buttonInteraction, context, hub, buttonResponder } = options;

  if (action === "home") {
    await buttonResponder.DeferUpdate(buttonInteraction);
    const payload = BuildHubPayload(hub);
    await buttonResponder.EditReply(buttonInteraction, {
      content: payload.content,
      embeds: payload.embeds,
      components: payload.components,
    });
    return;
  }

  if (action === "stats") {
    await buttonResponder.DeferUpdate(buttonInteraction);
    const statsEmbed = BuildHubStatsEmbed(context, hub);
    const payload = BuildHubPayload(hub);
    await buttonResponder.EditReply(buttonInteraction, {
      content: payload.content,
      embeds: [statsEmbed],
      components: payload.components,
    });
    return;
  }

  if (action === "help") {
    await buttonResponder.DeferUpdate(buttonInteraction);
    const guildId = hub.guildId;
    const allCommands = await GetAllCommandsCached(
      guildId,
      (id, commandName) =>
        context.databases.serverDb.IsCommandDisabled(id, commandName),
    );
    const categories = [
      BuildFeatureCategoryView(),
      ...BuildCategoryViews(allCommands),
    ];
    const overview = CreateOverviewPayload(categories, hub.interactionId);

    RegisterHelpButtons({
      categories,
      componentRouter: context.responders.componentRouter,
      buttonResponder: context.responders.buttonResponder,
      interaction: { id: hub.interactionId, user: { id: hub.member.id } },
      ownerId: hub.member.id,
    });

    await buttonResponder.EditReply(buttonInteraction, {
      content: overview.content,
      embeds: overview.embeds,
      components: overview.components,
    });
    return;
  }

  if (action === "ticket") {
    const guild = buttonInteraction.guild;
    if (!guild) {
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
          content: payload.content,
          embeds: payload.embeds,
          components: payload.components,
        });
      },
    });
    return;
  }

  if (action === "appeal") {
    const guild = buttonInteraction.guild;
    if (!guild) {
      return;
    }

    await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

    await BeginAppealSubmission({
      interaction: buttonInteraction,
      context,
      guild,
    });
    return;
  }

  if (action === "verify") {
    const guild = buttonInteraction.guild;
    if (!guild || !hub.settings) {
      return;
    }

    await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = await guild.members.fetch(buttonInteraction.user.id);
    const result = await VerifyGuildMember({
      member,
      settings: hub.settings,
    });

    if (!result.success) {
      const embed = EmbedFactory.CreateError({
        title: "Verification Failed",
        description: result.reason,
      });
      await buttonInteraction.editReply({ embeds: [embed.toJSON()] });
      return;
    }

    await buttonInteraction.editReply({
      embeds: [BuildVerificationSuccessEmbed(member, hub.settings)],
    });
    return;
  }

  if (!hub.isStaff) {
    await buttonResponder.Reply(buttonInteraction, {
      content: "You do not have permission for that action.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "staff-tickets") {
    await HandleStaffTickets(buttonInteraction, context);
    return;
  }

  if (action === "staff-appeals") {
    await HandleStaffAppeals(buttonInteraction, context);
    return;
  }

  if (action === "staff-commands") {
    await HandleStaffCommands(buttonInteraction, context, hub);
  }
}

async function HandleStaffTickets(
  buttonInteraction: ButtonInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = buttonInteraction.guild;
  if (!guild) {
    return;
  }

  await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  const { ticketDb } = CreateTicketServices(
    context.logger,
    guild,
    context.databases.ticketDb,
    context.databases.serverDb,
  );
  const openTickets = ticketDb.GetGuildTickets(guild.id, "open");
  const claimedTickets = ticketDb.GetGuildTickets(guild.id, "claimed");
  const tickets = [...openTickets, ...claimedTickets].sort(
    (a, b) => a.created_at - b.created_at,
  );

  const embed = EmbedFactory.Create({
    title: "Open Tickets",
    description:
      tickets.length > 0
        ? tickets
            .slice(0, 10)
            .map(
              (ticket) =>
                `**#${ticket.id}** — <@${ticket.user_id}> — <#${ticket.channel_id}>`,
            )
            .join("\n")
        : "No open tickets in this server.",
    footer:
      tickets.length > 10
        ? `Showing 10 of ${tickets.length} — use /ticket list scope:server`
        : undefined,
  });

  await buttonInteraction.editReply({ embeds: [embed.toJSON()] });
}

async function HandleStaffAppeals(
  buttonInteraction: ButtonInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = buttonInteraction.guild;
  if (!guild) {
    return;
  }

  await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  const manager = CreateAppealManager({
    guildId: guild.id,
    userId: buttonInteraction.user.id,
    moderationDb: context.databases.moderationDb,
    userDb: context.databases.userDb,
    logger: context.logger,
  });

  const appeals = manager.ListGuildOpenAppeals(100);
  if (appeals.length === 0) {
    const embed = EmbedFactory.Create({
      title: "Pending Appeals",
      description: "There are no open appeals in this guild.",
    });
    await buttonInteraction.editReply({ embeds: [embed.toJSON()] });
    return;
  }

  const pages = BuildAppealListPages(appeals);
  await buttonInteraction.editReply({
    embeds: pages[0].embeds,
  });
}

async function HandleStaffCommands(
  buttonInteraction: ButtonInteraction,
  context: CommandContext,
  hub: HubContext,
): Promise<void> {
  await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  const disabled = context.databases.serverDb.ListDisabledCommands(hub.guildId);
  const preview = disabled.slice(0, 5);
  const previewText =
    preview.length > 0
      ? preview.map((name) => `\`/${name}\``).join(", ")
      : "None";

  const embed = EmbedFactory.Create({
    title: "Command Status",
    description: `**${disabled.length}** command(s) disabled in this server.`,
  });

  embed.addFields({
    name: disabled.length > 0 ? "Disabled commands" : "Status",
    value:
      disabled.length > 0
        ? previewText +
          (disabled.length > 5
            ? `\n…and ${disabled.length - 5} more. Use \`/command list\`.`
            : "")
        : "All non-protected commands are enabled.",
    inline: false,
  });

  await buttonInteraction.editReply({ embeds: [embed.toJSON()] });
}

export async function ResolveHubContext(
  interaction: { guild: Guild; user: { id: string }; id: string },
  context: CommandContext,
): Promise<HubContext | null> {
  const settings = context.databases.serverDb.GetGuildSettings(
    interaction.guild.id,
  );
  const member = await interaction.guild.members.fetch(interaction.user.id);

  return {
    guildId: interaction.guild.id,
    guildName: interaction.guild.name,
    interactionId: interaction.id,
    member,
    settings,
    isStaff: IsModerator(member, {
      adminRoleIds: settings?.admin_role_ids,
      modRoleIds: settings?.mod_role_ids,
    }),
    levelingEnabled: context.databases.serverDb.GetGuildXpSettings(
      interaction.guild.id,
    ).enabled,
  };
}

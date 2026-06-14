import type {
  ActionRowComponentData,
  ActionRowData,
  APIEmbed,
  GuildMember,
} from "discord.js";
import { ButtonStyle } from "discord.js";
import type { CommandContext } from "@commands";
import type { GuildSettings } from "@database/Server/Types";
import { ComponentFactory, EmbedFactory, ToActionRowData } from "@utilities";
import { IsEconomyEnabled } from "@shared/GuildFeatures";
import { CreateHubActionCustomId } from "@commands/Utility/Hub/HubTypes";

export interface HubContext {
  readonly guildId: string;
  readonly guildName: string;
  readonly interactionId: string;
  readonly member: GuildMember;
  readonly settings: GuildSettings | null;
  readonly isStaff: boolean;
  readonly levelingEnabled: boolean;
}

export interface HubPayload {
  readonly content: string;
  readonly embeds: APIEmbed[];
  readonly components: ActionRowData<ActionRowComponentData>[];
}

function IsUnverified(member: GuildMember, settings: GuildSettings | null): boolean {
  return Boolean(
    settings?.verification_enabled &&
      settings.unverified_role_id &&
      member.roles.cache.has(settings.unverified_role_id),
  );
}

export function BuildHubPayload(hub: HubContext): HubPayload {
  const settings = hub.settings;
  const ticketsEnabled = Boolean(settings?.ticket_category_id);
  const appealsEnabled = Boolean(settings?.appeal_review_category_id);
  const needsVerify = IsUnverified(hub.member, settings);

  const verificationStatus = needsVerify
    ? "Unverified — complete verification to gain access"
    : settings?.verification_enabled
      ? "Verified"
      : "Verification not required";

  const embed = EmbedFactory.Create({
    title: "Quick Hub",
    description: `Welcome to **${hub.guildName}**. Use the buttons below for common actions.`,
    footer: "Use /help for the full command list",
  });

  embed.addFields({
    name: "Status",
    value: verificationStatus,
    inline: false,
  });

  const memberButtons: Array<{
    label: string;
    emoji?: string;
    action: Parameters<typeof CreateHubActionCustomId>[1];
    style?: ButtonStyle;
  }> = [
    { label: "Browse Commands", emoji: "📚", action: "help" },
  ];

  if ((settings?.economy_enabled ?? true) || hub.levelingEnabled) {
    memberButtons.push({ label: "My Stats", emoji: "📊", action: "stats" });
  }

  if (ticketsEnabled) {
    memberButtons.unshift({
      label: "Open Ticket",
      emoji: "🎫",
      action: "ticket",
      style: ButtonStyle.Primary,
    });
  }

  if (appealsEnabled) {
    memberButtons.push({
      label: "Submit Appeal",
      emoji: "⚖️",
      action: "appeal",
    });
  }

  if (needsVerify) {
    memberButtons.push({
      label: "Verify",
      emoji: "✅",
      action: "verify",
      style: ButtonStyle.Success,
    });
  }

  const rows: ActionRowData<ActionRowComponentData>[] = [];

  rows.push(
    ToActionRowData(
      BuildButtonRow(hub.interactionId, memberButtons.slice(0, 5)),
    ) as ActionRowData<ActionRowComponentData>,
  );

  if (memberButtons.length > 5) {
    rows.push(
      ToActionRowData(
        BuildButtonRow(hub.interactionId, memberButtons.slice(5)),
      ) as ActionRowData<ActionRowComponentData>,
    );
  }

  if (hub.isStaff) {
    rows.push(
      ToActionRowData(
        BuildButtonRow(hub.interactionId, [
          { label: "Open Tickets", emoji: "🎫", action: "staff-tickets" },
          { label: "Pending Appeals", emoji: "⚖️", action: "staff-appeals" },
          { label: "Command Status", emoji: "⚙️", action: "staff-commands" },
        ]),
      ) as ActionRowData<ActionRowComponentData>,
    );
  }

  return {
    content: `🏠 **Quick Hub** — ${hub.guildName}`,
    embeds: [embed.toJSON()],
    components: rows,
  };
}

function BuildButtonRow(
  interactionId: string,
  buttons: Array<{
    label: string;
    emoji?: string;
    action: Parameters<typeof CreateHubActionCustomId>[1];
    style?: ButtonStyle;
  }>,
): ReturnType<typeof ComponentFactory.CreateActionRow> {
  return ComponentFactory.CreateActionRow({
    buttons: buttons.map((button) => ({
      label: button.label,
      style: button.style ?? ButtonStyle.Secondary,
      emoji: button.emoji,
    })),
    customIds: buttons.map((button) =>
      CreateHubActionCustomId(interactionId, button.action),
    ),
  });
}

export function BuildHubStatsEmbed(
  context: CommandContext,
  hub: HubContext,
): APIEmbed {
  const userId = hub.member.id;
  const guildId = hub.guildId;
  const xp = context.databases.userDb.GetUserXp(userId, guildId);
  const balance = context.databases.userDb.GetBalance(userId, guildId);
  const warnings = context.databases.userDb.GetWarnings(userId, guildId);
  const tickets = context.databases.ticketDb.GetUserTickets(userId, guildId);
  const openTickets = tickets.filter(
    (ticket) => ticket.status === "open" || ticket.status === "claimed",
  );

  const embed = EmbedFactory.Create({
    title: "My Stats",
    description: `Quick overview for ${hub.member}`,
  });

  embed.addFields(
    {
      name: "Level",
      value: xp ? `**${xp.level}** (${xp.xp} XP)` : "No XP yet",
      inline: true,
    },
    ...(IsEconomyEnabled(context.databases.serverDb, guildId)
      ? [
          {
            name: "Coins",
            value: balance ? `**${balance.balance}**` : "**0**",
            inline: true,
          },
        ]
      : []),
    {
      name: "Warnings",
      value: `**${warnings.length}**`,
      inline: true,
    },
    {
      name: "Open Tickets",
      value: `**${openTickets.length}**`,
      inline: true,
    },
  );

  return embed.toJSON();
}

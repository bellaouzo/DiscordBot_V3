import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  Role,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import { ComponentFactory, ToActionRowData } from "@utilities";
import { LoadAppConfig } from "@config/AppConfig";
import {
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  DEFAULT_DELETE_LOG_CHANNEL,
  DEFAULT_PRODUCTION_LOG_CHANNEL,
  DEFAULT_TICKET_CATEGORY,
} from "../constants";
import { NavigationIds, SetupDraft, SetupResources } from "../state";

export function BuildStepComponents(options: {
  step: number;
  draft: SetupDraft;
  resources: SetupResources;
  ids: NavigationIds;
  loggingDefaults: ReturnType<typeof LoadAppConfig>["logging"];
}): ActionRowData<ActionRowComponentData>[] {
  const { draft, resources, ids, loggingDefaults } = options;
  const rows: ActionRowData<ActionRowComponentData>[] = [];

  switch (options.step) {
    case 1: {
      rows.push(
        BuildRoleSelectRow(
          ids.adminSelect,
          "Admin roles — full access",
          resources.roles,
          draft.adminRoleIds,
          "Admin Roles"
        ),
        BuildRoleSelectRow(
          ids.modSelect,
          "Mod roles — day-to-day moderation",
          resources.roles,
          draft.modRoleIds,
          "Mod Roles"
        )
      );
      break;
    }
    case 2: {
      rows.push(
        BuildTicketCategoryRow(
          ids.ticketSelect,
          resources.categories,
          draft.ticketCategoryId
        ),
        BuildChannelSelectRow({
          customId: ids.commandLogSelect,
          channels: resources.textChannels,
          selectedId: draft.commandLogChannelId,
          placeholder: "Choose a command log channel",
          defaultName: loggingDefaults.commandLogChannelName,
          includeCategoryName: loggingDefaults.commandLogCategoryName,
        }),
        BuildChannelSelectRow({
          customId: ids.deleteLogSelect,
          channels: resources.textChannels,
          selectedId: draft.deleteLogChannelId,
          placeholder: "Choose a delete logs channel",
          defaultName:
            loggingDefaults.messageDeleteChannelName ||
            DEFAULT_DELETE_LOG_CHANNEL,
        })
      );
      break;
    }
    case 3: {
      rows.push(
        BuildChannelSelectRow({
          customId: ids.announcementSelect,
          channels: resources.textChannels,
          selectedId: draft.announcementChannelId,
          placeholder: "Choose an announcements channel (optional)",
          defaultName: DEFAULT_ANNOUNCEMENT_CHANNEL,
        }),
        BuildChannelSelectRow({
          customId: ids.productionLogSelect,
          channels: resources.textChannels,
          selectedId: draft.productionLogChannelId,
          placeholder: "Choose a production logs channel (or disable)",
          defaultName:
            loggingDefaults.deployLogChannelName ||
            DEFAULT_PRODUCTION_LOG_CHANNEL,
          allowNone: true,
        }),
        BuildChannelSelectRow({
          customId: ids.welcomeSelect,
          channels: resources.textChannels,
          selectedId: draft.welcomeChannelId,
          placeholder: "Choose a welcome channel (optional)",
          defaultName: "welcome",
        })
      );
      break;
    }
    default:
      break;
  }

  rows.push(BuildNavigationRow(options.step, ids));
  return rows;
}

export function BuildRoleSelectRow(
  customId: string,
  placeholder: string,
  roles: Role[],
  selectedIds: string[],
  label?: string
): ActionRowData<ActionRowComponentData> {
  const hasRoles = roles.length > 0;
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(hasRoles ? 1 : 1)
    .setMaxValues(hasRoles ? Math.min(roles.length, 25) : 1);

  if (!hasRoles) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("No roles available")
        .setValue("noop")
        .setDescription("Create roles in Discord, then rerun /setup")
        .setDefault(true)
    );
  } else {
    roles.slice(0, 25).forEach((role) => {
      const roleId = String(role.id);
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(role.name.slice(0, 95))
        .setValue(roleId)
        .setDescription(`ID: ${roleId}`);

      if (selectedIds.includes(roleId)) {
        option.setDefault(true);
      }

      menu.addOptions(option);
    });
  }

  const row = ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu)
  );

  if (label) {
    return {
      ...row,
      components: row.components.map((component) => ({
        ...component,
        placeholder: label,
      })),
    };
  }

  return row;
}

export function BuildTicketCategoryRow(
  customId: string,
  categories: CategoryChannel[],
  selectedId: string | null
): ActionRowData<ActionRowComponentData> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Ticket category for new ticket channels")
    .setMinValues(1)
    .setMaxValues(1);

  const allowCreate = !selectedId;

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(`Auto-manage "${DEFAULT_TICKET_CATEGORY}"`)
      .setValue("auto")
      .setDescription("Let the bot create or use the default category")
      .setDefault(!selectedId)
  );

  if (allowCreate) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Create "${DEFAULT_TICKET_CATEGORY}" now`)
        .setValue("create")
        .setDescription("Create the default category immediately")
    );
  }

  categories.slice(0, 23).forEach((category) => {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(category.name.slice(0, 95))
      .setValue(category.id)
      .setDescription("Use existing category");

    if (selectedId === category.id) {
      option.setDefault(true);
    }

    menu.addOptions(option);
  });

  return ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu)
  );
}

export function BuildChannelSelectRow(options: {
  customId: string;
  channels: TextChannel[];
  selectedId: string | null;
  placeholder: string;
  defaultName: string;
  includeCategoryName?: string;
  allowNone?: boolean;
}): ActionRowData<ActionRowComponentData> {
  const selectedChannel =
    options.selectedId &&
    options.channels.find((channel) => channel.id === options.selectedId);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(options.customId)
    .setPlaceholder(options.placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  const allowCreate = !options.selectedId;
  const isNoneSelected = options.allowNone && options.selectedId === null;

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(`Auto-manage "${options.defaultName}"`)
      .setValue("auto")
      .setDescription("Use defaults or create when needed")
      .setDefault(!options.selectedId && !isNoneSelected)
  );

  if (allowCreate) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Create #${options.defaultName}`)
        .setValue("create")
        .setDescription(
          options.includeCategoryName
            ? `Create under ${options.includeCategoryName}`
            : "Create this channel now"
        )
    );
  }

  if (options.allowNone) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Production logs: disable (none)")
        .setValue("none")
        .setDescription("Do not use a channel for this")
        .setDefault(isNoneSelected)
    );
  }

  const optionValues = new Set<string>();

  options.channels.slice(0, 23).forEach((channel) => {
    const channelId = String(channel.id);
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(`#${channel.name}`.slice(0, 95))
      .setValue(channelId)
      .setDescription("Use existing text channel");

    if (options.selectedId === channelId) {
      option.setDefault(true);
    }

    optionValues.add(channelId);
    menu.addOptions(option);
  });

  if (selectedChannel && !optionValues.has(String(selectedChannel.id))) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`#${selectedChannel.name}`.slice(0, 95))
        .setValue(String(selectedChannel.id))
        .setDescription("Use existing text channel")
        .setDefault(true)
    );
  }

  return ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu)
  );
}

export function BuildNavigationRow(
  step: number,
  ids: NavigationIds
): ActionRowData<ActionRowComponentData> {
  const isFinalStep = step >= 3;
  const buttons = [
    {
      label: "Back",
      style: ButtonStyle.Secondary,
      emoji: "◀",
      disabled: step === 1,
    },
    ...(isFinalStep
      ? []
      : [
          {
            label: "Next",
            style: ButtonStyle.Primary,
            emoji: "▶",
          },
        ]),
    {
      label: "Save & Quit",
      style: ButtonStyle.Success,
      emoji: "💾",
    },
    {
      label: "Cancel",
      style: ButtonStyle.Danger,
      emoji: "✖",
    },
  ];

  const customIds = [
    ids.back,
    ...(isFinalStep ? [] : [ids.next]),
    ids.saveAndQuit,
    ids.cancel,
  ];

  return ComponentFactory.CreateActionRow({
    buttons,
    customIds,
  }).toJSON() as ActionRowData<ActionRowComponentData>;
}

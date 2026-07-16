import type {
  ActionRowComponentData,
  ActionRowData,
  Role,
  TextChannel,
  CategoryChannel,
} from "discord.js";
import {
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { ComponentFactory, ToActionRowData } from "@utilities";
import { DEFAULT_TICKET_CATEGORY } from "../constants";

export function BuildRoleSelectRow(
  customId: string,
  placeholder: string,
  roles: Role[],
  selectedIds: string[],
  label?: string,
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
        .setDefault(true),
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
    ComponentFactory.CreateSelectMenuRow(menu),
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

export function BuildSingleRoleSelectRow(options: {
  customId: string;
  placeholder: string;
  roles: Role[];
  selectedId: string | null;
  allowNone?: boolean;
}): ActionRowData<ActionRowComponentData> {
  const {
    customId,
    placeholder,
    roles,
    selectedId,
    allowNone = false,
  } = options;
  const hasRoles = roles.length > 0;
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  if (allowNone) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("None")
        .setValue("none")
        .setDescription("Do not assign this role")
        .setDefault(!selectedId),
    );
  }

  if (!hasRoles) {
    if (!allowNone) {
      menu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("No roles available")
          .setValue("noop")
          .setDescription("Create roles in Discord, then rerun /setup")
          .setDefault(true),
      );
    }
  } else {
    roles.slice(0, allowNone ? 24 : 25).forEach((role) => {
      const roleId = String(role.id);
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(role.name.slice(0, 95))
        .setValue(roleId)
        .setDescription(`ID: ${roleId}`);

      if (selectedId === roleId) {
        option.setDefault(true);
      }

      menu.addOptions(option);
    });
  }

  return ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu),
  );
}

export function BuildCategorySelectRow(options: {
  customId: string;
  categories: CategoryChannel[];
  selectedId: string | null;
  placeholder: string;
  defaultCategoryName: string;
}): ActionRowData<ActionRowComponentData> {
  const { customId, categories, placeholder, defaultCategoryName } = options;
  const selectedId = options.selectedId ? String(options.selectedId) : null;
  const selectedCategory =
    selectedId &&
    categories.find((category) => String(category.id) === selectedId);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  const allowCreate = !selectedId;
  const reservedSlots = 1 + (allowCreate ? 1 : 0);
  const maxCategoryOptions = Math.max(0, 25 - reservedSlots);

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(`Auto-manage "${defaultCategoryName}"`)
      .setValue("auto")
      .setDescription("Let the bot create or use the default category")
      .setDefault(!selectedId),
  );

  if (allowCreate) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Create "${defaultCategoryName}" now`)
        .setValue("create")
        .setDescription("Create the default category immediately"),
    );
  }

  const optionValues = new Set<string>();

  categories.slice(0, maxCategoryOptions).forEach((category) => {
    const categoryId = String(category.id);
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(category.name.slice(0, 95))
      .setValue(categoryId)
      .setDescription("Use existing category");

    if (selectedId === categoryId) {
      option.setDefault(true);
    }

    optionValues.add(categoryId);
    menu.addOptions(option);
  });

  if (selectedCategory && !optionValues.has(String(selectedCategory.id))) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(selectedCategory.name.slice(0, 95))
        .setValue(String(selectedCategory.id))
        .setDescription("Use existing category")
        .setDefault(true),
    );
  }

  return ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu),
  );
}

export function BuildTicketCategoryRow(
  customId: string,
  categories: CategoryChannel[],
  selectedId: string | null,
): ActionRowData<ActionRowComponentData> {
  return BuildCategorySelectRow({
    customId,
    categories,
    selectedId,
    placeholder: "Ticket category for new ticket channels",
    defaultCategoryName: DEFAULT_TICKET_CATEGORY,
  });
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
  const selectedId = options.selectedId ? String(options.selectedId) : null;
  const selectedChannel =
    selectedId &&
    options.channels.find((channel) => String(channel.id) === selectedId);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(options.customId)
    .setPlaceholder(options.placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  const allowCreate = !selectedId;
  const isNoneSelected = Boolean(options.allowNone && selectedId === null);
  const reservedSlots =
    1 + (allowCreate ? 1 : 0) + (options.allowNone ? 1 : 0);
  const maxChannelOptions = Math.max(0, 25 - reservedSlots);

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(`Auto-manage "${options.defaultName}"`)
      .setValue("auto")
      .setDescription("Use defaults or create when needed")
      .setDefault(!selectedId && !isNoneSelected),
  );

  if (allowCreate) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Create #${options.defaultName}`)
        .setValue("create")
        .setDescription(
          options.includeCategoryName
            ? `Create under ${options.includeCategoryName}`
            : "Create this channel now",
        ),
    );
  }

  if (options.allowNone) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("None")
        .setValue("none")
        .setDescription("Do not use a channel for this")
        .setDefault(isNoneSelected),
    );
  }

  const optionValues = new Set<string>();

  options.channels.slice(0, maxChannelOptions).forEach((channel) => {
    const channelId = String(channel.id);
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(`#${channel.name}`.slice(0, 95))
      .setValue(channelId)
      .setDescription("Use existing text channel");

    if (selectedId === channelId) {
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
        .setDefault(true),
    );
  }

  return ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu),
  );
}

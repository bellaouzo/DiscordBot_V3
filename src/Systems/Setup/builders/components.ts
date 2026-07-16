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

function FormatFieldOptionLabel(
  fieldLabel: string,
  valueLabel: string,
  selected: boolean,
): string {
  if (!selected) {
    return valueLabel.slice(0, 100);
  }

  return `${fieldLabel}: ${valueLabel}`.slice(0, 100);
}

export function BuildRoleSelectRow(
  customId: string,
  placeholder: string,
  roles: Role[],
  selectedIds: string[],
  fieldLabel: string,
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
      const selected = selectedIds.includes(roleId);
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(FormatFieldOptionLabel(fieldLabel, role.name, selected))
        .setValue(roleId)
        .setDescription(`${fieldLabel} · ID: ${roleId}`.slice(0, 100));

      if (selected) {
        option.setDefault(true);
      }

      menu.addOptions(option);
    });
  }

  return ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu),
  );
}

export function BuildSingleRoleSelectRow(options: {
  customId: string;
  placeholder: string;
  fieldLabel: string;
  roles: Role[];
  selectedId: string | null;
  allowNone?: boolean;
}): ActionRowData<ActionRowComponentData> {
  const {
    customId,
    placeholder,
    fieldLabel,
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
    const noneSelected = !selectedId;
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(FormatFieldOptionLabel(fieldLabel, "None", noneSelected))
        .setValue("none")
        .setDescription(`Do not set ${fieldLabel}`)
        .setDefault(noneSelected),
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
      const selected = selectedId === roleId;
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(FormatFieldOptionLabel(fieldLabel, role.name, selected))
        .setValue(roleId)
        .setDescription(`${fieldLabel} · ID: ${roleId}`.slice(0, 100));

      if (selected) {
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
  fieldLabel: string;
  defaultCategoryName: string;
}): ActionRowData<ActionRowComponentData> {
  const { customId, categories, placeholder, fieldLabel, defaultCategoryName } =
    options;
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
  const autoSelected = !selectedId;
  const reservedSlots = 1 + (allowCreate ? 1 : 0);
  const maxCategoryOptions = Math.max(0, 25 - reservedSlots);

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(
        FormatFieldOptionLabel(
          fieldLabel,
          `Auto-manage "${defaultCategoryName}"`,
          autoSelected,
        ),
      )
      .setValue("auto")
      .setDescription(`${fieldLabel} · create or use the default category`)
      .setDefault(autoSelected),
  );

  if (allowCreate) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Create "${defaultCategoryName}" now`)
        .setValue("create")
        .setDescription(`${fieldLabel} · create immediately`),
    );
  }

  const optionValues = new Set<string>();

  categories.slice(0, maxCategoryOptions).forEach((category) => {
    const categoryId = String(category.id);
    const selected = selectedId === categoryId;
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(FormatFieldOptionLabel(fieldLabel, category.name, selected))
      .setValue(categoryId)
      .setDescription(`${fieldLabel} · use existing category`);

    if (selected) {
      option.setDefault(true);
    }

    optionValues.add(categoryId);
    menu.addOptions(option);
  });

  if (selectedCategory && !optionValues.has(String(selectedCategory.id))) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(
          FormatFieldOptionLabel(fieldLabel, selectedCategory.name, true),
        )
        .setValue(String(selectedCategory.id))
        .setDescription(`${fieldLabel} · use existing category`)
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
    placeholder: "Ticket category — where new ticket channels go",
    fieldLabel: "Ticket category",
    defaultCategoryName: DEFAULT_TICKET_CATEGORY,
  });
}

export function BuildChannelSelectRow(options: {
  customId: string;
  channels: TextChannel[];
  selectedId: string | null;
  placeholder: string;
  fieldLabel: string;
  defaultName: string;
  includeCategoryName?: string;
  allowNone?: boolean;
}): ActionRowData<ActionRowComponentData> {
  const selectedId = options.selectedId ? String(options.selectedId) : null;
  const selectedChannel =
    selectedId &&
    options.channels.find((channel) => String(channel.id) === selectedId);
  const { fieldLabel } = options;

  const menu = new StringSelectMenuBuilder()
    .setCustomId(options.customId)
    .setPlaceholder(options.placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  const allowCreate = !selectedId;
  const isNoneSelected = Boolean(options.allowNone && selectedId === null);
  const autoSelected = !selectedId && !isNoneSelected;
  const reservedSlots = 1 + (allowCreate ? 1 : 0) + (options.allowNone ? 1 : 0);
  const maxChannelOptions = Math.max(0, 25 - reservedSlots);

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(
        FormatFieldOptionLabel(
          fieldLabel,
          `Auto-manage #${options.defaultName}`,
          autoSelected,
        ),
      )
      .setValue("auto")
      .setDescription(`${fieldLabel} · use defaults or create when needed`)
      .setDefault(autoSelected),
  );

  if (allowCreate) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Create #${options.defaultName}`)
        .setValue("create")
        .setDescription(
          options.includeCategoryName
            ? `${fieldLabel} · create under ${options.includeCategoryName}`
            : `${fieldLabel} · create this channel now`,
        ),
    );
  }

  if (options.allowNone) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(FormatFieldOptionLabel(fieldLabel, "None", isNoneSelected))
        .setValue("none")
        .setDescription(`Do not use a channel for ${fieldLabel}`)
        .setDefault(isNoneSelected),
    );
  }

  const optionValues = new Set<string>();

  options.channels.slice(0, maxChannelOptions).forEach((channel) => {
    const channelId = String(channel.id);
    const selected = selectedId === channelId;
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(
        FormatFieldOptionLabel(fieldLabel, `#${channel.name}`, selected),
      )
      .setValue(channelId)
      .setDescription(`${fieldLabel} · use existing text channel`);

    if (selected) {
      option.setDefault(true);
    }

    optionValues.add(channelId);
    menu.addOptions(option);
  });

  if (selectedChannel && !optionValues.has(String(selectedChannel.id))) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(
          FormatFieldOptionLabel(fieldLabel, `#${selectedChannel.name}`, true),
        )
        .setValue(String(selectedChannel.id))
        .setDescription(`${fieldLabel} · use existing text channel`)
        .setDefault(true),
    );
  }

  return ToActionRowData<ActionRowComponentData>(
    ComponentFactory.CreateSelectMenuRow(menu),
  );
}

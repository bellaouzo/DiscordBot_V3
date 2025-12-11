import {
  ActionRowComponentData,
  ActionRowData,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  Role,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import {
  LoggingMiddleware,
  ErrorMiddleware,
  PermissionMiddleware,
} from "@middleware";
import { Config } from "@middleware/CommandConfig";
import {
  ComponentFactory,
  CreateChannelManager,
  EmbedFactory,
} from "@utilities";
import { GuildSettings } from "@database/ServerDatabase";
import { LoadAppConfig } from "@config/AppConfig";

interface SetupDraft {
  adminRoleIds: string[];
  modRoleIds: string[];
  ticketCategoryId: string | null;
  commandLogChannelId: string | null;
  announcementChannelId: string | null;
}

interface SetupResources {
  roles: Role[];
  categories: CategoryChannel[];
  textChannels: TextChannel[];
}

interface NavigationIds {
  adminSelect: string;
  modSelect: string;
  ticketSelect: string;
  commandLogSelect: string;
  announcementSelect: string;
  next: string;
  back: string;
  save: string;
  cancel: string;
}

const DEFAULT_TICKET_CATEGORY = "Support Tickets";
const DEFAULT_ANNOUNCEMENT_CHANNEL = "announcements";
const SETUP_TIMEOUT_MS = 10 * 60 * 1000;

async function SanitizeGuildSettings(
  guild: ChatInputCommandInteraction["guild"],
  settings: GuildSettings
): Promise<GuildSettings> {
  const ticketCategoryId = await ResolveExistingChannelId(
    guild,
    settings.ticket_category_id,
    ChannelType.GuildCategory
  );

  const commandLogChannelId = await ResolveExistingChannelId(
    guild,
    settings.command_log_channel_id,
    ChannelType.GuildText
  );

  const announcementChannelId = await ResolveExistingChannelId(
    guild,
    settings.announcement_channel_id,
    ChannelType.GuildText
  );

  return {
    ...settings,
    ticket_category_id: ticketCategoryId,
    command_log_channel_id: commandLogChannelId,
    announcement_channel_id: announcementChannelId,
  };
}

async function ResolveExistingChannelId(
  guild: ChatInputCommandInteraction["guild"],
  channelId: string | null,
  expectedType: ChannelType
): Promise<string | null> {
  if (!channelId) {
    return null;
  }

  try {
    const channel = await guild?.channels.fetch(channelId);
    if (!channel || channel.type !== expectedType) {
      return null;
    }
    return channelId;
  } catch {
    return null;
  }
}

async function ExecuteSetup(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const {
    interactionResponder,
    selectMenuRouter,
    componentRouter,
    buttonResponder,
  } = context.responders;
  const { logger, databases } = context;

  if (!interaction.guild) {
    const embed = EmbedFactory.CreateError({
      title: "Guild Only",
      description: "Run this command inside a server to configure the bot.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  const channelManager = CreateChannelManager({ guild, logger });
  const loggingDefaults = LoadAppConfig().logging;
  const currentSettings =
    databases.serverDb.GetGuildSettings(guild.id) ??
    CreateEmptySettings(guild.id);

  const sanitizedSettings = await SanitizeGuildSettings(guild, currentSettings);

  const settingsChanged =
    sanitizedSettings.ticket_category_id !==
      currentSettings.ticket_category_id ||
    sanitizedSettings.command_log_channel_id !==
      currentSettings.command_log_channel_id ||
    sanitizedSettings.announcement_channel_id !==
      currentSettings.announcement_channel_id;

  if (settingsChanged) {
    databases.serverDb.UpsertGuildSettings({
      guild_id: guild.id,
      admin_role_ids: sanitizedSettings.admin_role_ids,
      mod_role_ids: sanitizedSettings.mod_role_ids,
      ticket_category_id: sanitizedSettings.ticket_category_id,
      command_log_channel_id: sanitizedSettings.command_log_channel_id,
      announcement_channel_id: sanitizedSettings.announcement_channel_id,
    });
  }

  const draft: SetupDraft = {
    adminRoleIds: [...sanitizedSettings.admin_role_ids],
    modRoleIds: [...sanitizedSettings.mod_role_ids],
    ticketCategoryId: sanitizedSettings.ticket_category_id,
    commandLogChannelId: sanitizedSettings.command_log_channel_id,
    announcementChannelId: sanitizedSettings.announcement_channel_id,
  };

  const resources = CollectResources(guild);

  const ids: NavigationIds = {
    adminSelect: `setup:${interaction.id}:admin`,
    modSelect: `setup:${interaction.id}:mod`,
    ticketSelect: `setup:${interaction.id}:ticket`,
    commandLogSelect: `setup:${interaction.id}:cmdlog`,
    announcementSelect: `setup:${interaction.id}:announce`,
    next: `setup:${interaction.id}:next`,
    back: `setup:${interaction.id}:back`,
    save: `setup:${interaction.id}:save`,
    cancel: `setup:${interaction.id}:cancel`,
  };

  let currentStep = 1;

  const updateMessage = async (): Promise<void> => {
    await interaction.editReply({
      embeds: [
        BuildSetupEmbed({
          draft,
          step: currentStep,
          guild,
          loggingDefaults,
        }).toJSON(),
      ],
      components: BuildStepComponents({
        step: currentStep,
        draft,
        resources,
        ids,
        loggingDefaults,
      }),
    });
  };

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.adminSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selected = selectInteraction.values.filter(
        (value) => value !== "none"
      );
      draft.adminRoleIds = selected;

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.modSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selected = selectInteraction.values.filter(
        (value) => value !== "none"
      );
      draft.modRoleIds = selected;

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.ticketSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.ticketCategoryId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateCategory(
          DEFAULT_TICKET_CATEGORY
        );
        if (created) {
          draft.ticketCategoryId = created.id;
          if (
            !resources.categories.find((category) => category.id === created.id)
          ) {
            resources.categories.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the ticket category. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.ticketCategoryId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.commandLogSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.commandLogChannelId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateTextChannel(
          loggingDefaults.commandLogChannelName,
          loggingDefaults.commandLogCategoryName
        );
        if (created) {
          draft.commandLogChannelId = created.id;
          if (
            !resources.textChannels.find((channel) => channel.id === created.id)
          ) {
            resources.textChannels.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the command log channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.commandLogChannelId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  selectMenuRouter.RegisterSelectMenu({
    customId: ids.announcementSelect,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (selectInteraction) => {
      const selection = selectInteraction.values[0];

      if (selection === "auto") {
        draft.announcementChannelId = null;
      } else if (selection === "create") {
        const created = await channelManager.GetOrCreateTextChannel(
          DEFAULT_ANNOUNCEMENT_CHANNEL
        );
        if (created) {
          draft.announcementChannelId = created.id;
          if (
            !resources.textChannels.find((channel) => channel.id === created.id)
          ) {
            resources.textChannels.unshift(created);
          }
        } else {
          await selectInteraction.followUp({
            content:
              "Could not create the announcements channel. Check bot permissions.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        draft.announcementChannelId = selection;
      }

      await selectInteraction.deferUpdate();
      await updateMessage();
    },
  });

  componentRouter.RegisterButton({
    customId: ids.next,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      currentStep = Math.min(currentStep + 1, 3);
      await buttonResponder.DeferUpdate(buttonInteraction);
      await updateMessage();
    },
  });

  componentRouter.RegisterButton({
    customId: ids.back,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      currentStep = Math.max(currentStep - 1, 1);
      await buttonResponder.DeferUpdate(buttonInteraction);
      await updateMessage();
    },
  });

  componentRouter.RegisterButton({
    customId: ids.cancel,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      await buttonResponder.DeferUpdate(buttonInteraction);
      await buttonResponder.EditReply(buttonInteraction, {
        embeds: [
          EmbedFactory.CreateWarning({
            title: "Setup Cancelled",
            description: "No changes were saved.",
          }).toJSON(),
        ],
        components: [],
      });
    },
  });

  componentRouter.RegisterButton({
    customId: ids.save,
    ownerId: interaction.user.id,
    expiresInMs: SETUP_TIMEOUT_MS,
    handler: async (buttonInteraction) => {
      const saved = databases.serverDb.UpsertGuildSettings({
        guild_id: guild.id,
        admin_role_ids: draft.adminRoleIds,
        mod_role_ids: draft.modRoleIds,
        ticket_category_id: draft.ticketCategoryId,
        command_log_channel_id: draft.commandLogChannelId,
        announcement_channel_id: draft.announcementChannelId,
      });

      await buttonResponder.DeferUpdate(buttonInteraction);
      await buttonResponder.EditReply(buttonInteraction, {
        embeds: [
          EmbedFactory.CreateSuccess({
            title: "Setup Saved",
            description:
              "Your configuration has been saved. You can rerun `/setup` anytime to update it.",
          }).toJSON(),
        ],
        components: [],
      });

      draft.adminRoleIds = [...saved.admin_role_ids];
      draft.modRoleIds = [...saved.mod_role_ids];
      draft.ticketCategoryId = saved.ticket_category_id;
      draft.commandLogChannelId = saved.command_log_channel_id;
      draft.announcementChannelId = saved.announcement_channel_id;
    },
  });

  await interactionResponder.Reply(interaction, {
    embeds: [
      BuildSetupEmbed({
        draft,
        step: currentStep,
        guild,
        loggingDefaults,
      }).toJSON(),
    ],
    components: BuildStepComponents({
      step: currentStep,
      draft,
      resources,
      ids,
      loggingDefaults,
    }),
    ephemeral: true,
  });
}

function BuildSetupEmbed(options: {
  draft: SetupDraft;
  step: number;
  guild: ChatInputCommandInteraction["guild"];
  loggingDefaults: ReturnType<typeof LoadAppConfig>["logging"];
}) {
  const { draft, step, guild, loggingDefaults } = options;
  const embed = EmbedFactory.Create({
    title: `Server Setup — Step ${step}/3`,
    description:
      "Use the menus below to pick roles and channels. Selections are restricted to you.",
    color: 0x5865f2,
  });

  embed.addFields(
    {
      name: "Admin Roles",
      value: FormatRoleList(draft.adminRoleIds, guild),
      inline: true,
    },
    {
      name: "Mod Roles",
      value: FormatRoleList(draft.modRoleIds, guild),
      inline: true,
    },
    {
      name: "Ticket Category",
      value: FormatCategory(
        draft.ticketCategoryId,
        guild,
        DEFAULT_TICKET_CATEGORY
      ),
      inline: false,
    },
    {
      name: "Command Logs",
      value: FormatChannel(
        draft.commandLogChannelId,
        guild,
        loggingDefaults.commandLogChannelName
      ),
      inline: false,
    },
    {
      name: "Announcements",
      value: FormatChannel(
        draft.announcementChannelId,
        guild,
        DEFAULT_ANNOUNCEMENT_CHANNEL
      ),
      inline: false,
    }
  );

  return embed;
}

function BuildStepComponents(options: {
  step: number;
  draft: SetupDraft;
  resources: SetupResources;
  ids: NavigationIds;
  loggingDefaults: ReturnType<typeof LoadAppConfig>["logging"];
}): ActionRowData<ActionRowComponentData>[] {
  const rows: ActionRowData<ActionRowComponentData>[] = [];

  if (options.step === 1) {
    rows.push(
      BuildRoleSelectRow(
        options.ids.adminSelect,
        "Admin roles — full access",
        options.resources.roles,
        options.draft.adminRoleIds,
        "Admin Roles",
        "Admin: None (use perms)"
      )
    );
    rows.push(
      BuildRoleSelectRow(
        options.ids.modSelect,
        "Mod roles — day-to-day moderation",
        options.resources.roles,
        options.draft.modRoleIds,
        "Mod Roles",
        "Mod: None (use perms)"
      )
    );
  } else if (options.step === 2) {
    rows.push(
      BuildTicketCategoryRow(
        options.ids.ticketSelect,
        options.resources.categories,
        options.draft.ticketCategoryId
      )
    );
    rows.push(
      BuildChannelSelectRow({
        customId: options.ids.commandLogSelect,
        channels: options.resources.textChannels,
        selectedId: options.draft.commandLogChannelId,
        placeholder: "Choose a command log channel",
        defaultName: options.loggingDefaults.commandLogChannelName,
        includeCategoryName: options.loggingDefaults.commandLogCategoryName,
      })
    );
  } else if (options.step === 3) {
    rows.push(
      BuildChannelSelectRow({
        customId: options.ids.announcementSelect,
        channels: options.resources.textChannels,
        selectedId: options.draft.announcementChannelId,
        placeholder: "Choose an announcements channel (optional)",
        defaultName: DEFAULT_ANNOUNCEMENT_CHANNEL,
      })
    );
  }

  rows.push(BuildNavigationRow(options.step, options.ids));

  return rows;
}

function BuildRoleSelectRow(
  customId: string,
  placeholder: string,
  roles: Role[],
  selectedIds: string[],
  label?: string,
  noneLabel?: string
): ActionRowData<ActionRowComponentData> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(0)
    .setMaxValues(Math.min(roles.length + 1, 5));

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(noneLabel ?? "None (use perms)")
      .setValue("none")
      .setDescription("No dedicated role required")
      .setDefault(selectedIds.length === 0)
  );

  roles.slice(0, 24).forEach((role) => {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(role.name.slice(0, 95))
      .setValue(role.id)
      .setDescription(`ID: ${role.id}`);

    if (selectedIds.includes(role.id)) {
      option.setDefault(true);
    }

    menu.addOptions(option);
  });

  const row = ComponentFactory.CreateSelectMenuRow(
    menu
  ).toJSON() as unknown as ActionRowData<ActionRowComponentData>;

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

function BuildTicketCategoryRow(
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

  return ComponentFactory.CreateSelectMenuRow(
    menu
  ).toJSON() as unknown as ActionRowData<ActionRowComponentData>;
}

function BuildChannelSelectRow(options: {
  customId: string;
  channels: TextChannel[];
  selectedId: string | null;
  placeholder: string;
  defaultName: string;
  includeCategoryName?: string;
}): ActionRowData<ActionRowComponentData> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(options.customId)
    .setPlaceholder(options.placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  const allowCreate = !options.selectedId;

  menu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel(`Auto-manage "${options.defaultName}"`)
      .setValue("auto")
      .setDescription("Use defaults or create when needed")
      .setDefault(!options.selectedId)
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

  options.channels.slice(0, 23).forEach((channel) => {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(`#${channel.name}`.slice(0, 95))
      .setValue(channel.id)
      .setDescription("Use existing text channel");

    if (options.selectedId === channel.id) {
      option.setDefault(true);
    }

    menu.addOptions(option);
  });

  return ComponentFactory.CreateSelectMenuRow(
    menu
  ).toJSON() as unknown as ActionRowData<ActionRowComponentData>;
}

function BuildNavigationRow(
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
    {
      label: isFinalStep ? "Save" : "Next",
      style: isFinalStep ? ButtonStyle.Success : ButtonStyle.Primary,
      emoji: isFinalStep ? "💾" : "▶",
    },
    {
      label: "Cancel",
      style: ButtonStyle.Danger,
      emoji: "✖",
    },
  ];

  const customIds = [ids.back, isFinalStep ? ids.save : ids.next, ids.cancel];

  return ComponentFactory.CreateActionRow({
    buttons,
    customIds,
  }).toJSON() as ActionRowData<ActionRowComponentData>;
}

function CollectResources(
  guild: ChatInputCommandInteraction["guild"]
): SetupResources {
  const roles = guild?.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((first, second) => second.position - first.position);

  const categories = guild?.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildCategory)
    .map((channel) => channel as CategoryChannel)
    .sort((a, b) => b.rawPosition - a.rawPosition);

  const textChannels = guild?.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildText)
    .map((channel) => channel as TextChannel)
    .sort((a, b) => b.rawPosition - a.rawPosition);

  return {
    roles: roles ? Array.from(roles.values()) : [],
    categories: categories ?? [],
    textChannels: textChannels ?? [],
  };
}

function FormatRoleList(
  roleIds: string[],
  guild: ChatInputCommandInteraction["guild"]
): string {
  if (!roleIds || roleIds.length === 0) {
    return "None (uses Discord permissions)";
  }

  const mentions = roleIds
    .map((id) => guild?.roles.cache.get(id))
    .filter((role): role is Role => Boolean(role))
    .map((role) => role.toString());

  if (mentions.length === 0) {
    return "Roles not found (they may have been deleted)";
  }

  return mentions.join(", ");
}

function FormatCategory(
  categoryId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string
): string {
  if (!categoryId) {
    return `Auto-manage **${fallbackName}**`;
  }

  const category = guild?.channels.cache.get(categoryId) as
    | CategoryChannel
    | undefined;
  return category
    ? `${category.name} (${categoryId})`
    : `Category ID: ${categoryId}`;
}

function FormatChannel(
  channelId: string | null,
  guild: ChatInputCommandInteraction["guild"],
  fallbackName: string
): string {
  if (!channelId) {
    return `Auto-manage **${fallbackName}**`;
  }

  const channel = guild?.channels.cache.get(channelId) as
    | TextChannel
    | undefined;
  return channel ? channel.toString() : `Channel ID: ${channelId}`;
}

function CreateEmptySettings(guild_id: string): GuildSettings {
  return {
    guild_id,
    admin_role_ids: [],
    mod_role_ids: [],
    ticket_category_id: null,
    command_log_channel_id: null,
    announcement_channel_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

export const SetupCommand = CreateCommand({
  name: "setup",
  description: "Interactive first-time setup for roles and channels",
  group: "admin",
  middleware: {
    before: [LoggingMiddleware, PermissionMiddleware],
    after: [ErrorMiddleware],
  },
  config: Config.create()
    .anyPermission("ManageGuild", "Administrator")
    .cooldownSeconds(3)
    .build(),
  execute: ExecuteSetup,
});

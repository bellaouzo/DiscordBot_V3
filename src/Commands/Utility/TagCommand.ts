import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { CommandContext } from "@commands";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import {
  EmbedFactory,
  IsModerator,
  RequireGuild,
  ResolveInteractionMember,
} from "@utilities";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";
import type { PaginationPage } from "@shared/Paginator";
import {
  NormalizeTagName,
  RenderTagContent,
  TAG_CONTENT_MAX_LENGTH,
  TAG_LIMIT_PER_GUILD,
  TAG_NAME_MAX_LENGTH,
  TAG_PREFIX_DISABLED,
  TAG_PREFIX_MAX_LENGTH,
  TagAllowedMentions,
  ValidateTagName,
  ValidateTagPrefix,
} from "@systems/Tags/TagContent";

const TAG_MODAL_TIMEOUT_MS = 10 * 60 * 1000;
const TAG_LIST_PAGE_SIZE = 20;
const CONTENT_INPUT_ID = "content";

type TagReplyKind = "error" | "warning" | "success";

async function ReplyEphemeral(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  kind: TagReplyKind,
  title: string,
  description: string,
): Promise<void> {
  const embed =
    kind === "error"
      ? EmbedFactory.CreateError({ title, description })
      : kind === "warning"
        ? EmbedFactory.CreateWarning({ title, description })
        : EmbedFactory.CreateSuccess({ title, description });
  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

/** Replies with an error and returns false unless the user is staff. */
async function RequireStaff(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<boolean> {
  const guild = RequireGuild(interaction);
  const settings = context.databases.serverDb.GetGuildSettings(guild.id);
  const member = await ResolveInteractionMember(interaction);
  if (IsModerator(member, settings)) {
    return true;
  }
  await ReplyEphemeral(
    interaction,
    context,
    "error",
    "Permission Denied",
    "Only moderators can manage tags.",
  );
  return false;
}

function ReadTagName(interaction: ChatInputCommandInteraction): string {
  return NormalizeTagName(interaction.options.getString("name", true));
}

function BuildContentModal(options: {
  customId: string;
  title: string;
  existingContent?: string;
}): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId(CONTENT_INPUT_ID)
    .setLabel("Tag content")
    .setPlaceholder("Placeholders: {user} {server} {channel} {membercount}")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(TAG_CONTENT_MAX_LENGTH);
  if (options.existingContent) {
    input.setValue(options.existingContent);
  }
  return new ModalBuilder()
    .setCustomId(options.customId)
    .setTitle(options.title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );
}

/** Registers a single-use modal handler for the invoking user, then shows the modal. */
async function ShowContentModal(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  options: {
    title: string;
    existingContent?: string;
    onSubmit: (modal: ModalSubmitInteraction, content: string) => Promise<void>;
  },
): Promise<void> {
  const customId = `tag-content:${interaction.id}`;
  context.responders.modalRouter.RegisterModal({
    customId,
    ownerId: interaction.user.id,
    singleUse: true,
    expiresInMs: TAG_MODAL_TIMEOUT_MS,
    handler: async (modal) => {
      const content = modal.fields.getTextInputValue(CONTENT_INPUT_ID).trim();
      if (content.length === 0) {
        await modal.reply({
          embeds: [
            EmbedFactory.CreateError({
              title: "Empty Tag",
              description: "Tag content cannot be empty.",
            }).toJSON(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await options.onSubmit(modal, content);
    },
  });

  await interaction.showModal(
    BuildContentModal({
      customId,
      title: options.title,
      existingContent: options.existingContent,
    }),
  );
}

async function ReplyToModal(
  modal: ModalSubmitInteraction,
  embed: ReturnType<typeof EmbedFactory.Create>,
): Promise<void> {
  await modal.reply({
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function HandleShow(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const name = ReadTagName(interaction);
  const tag = context.databases.serverDb.GetCustomTag(guild.id, name);

  if (!tag) {
    await ReplyEphemeral(
      interaction,
      context,
      "warning",
      "Tag Not Found",
      `No tag named \`${name}\` exists. Use \`/tag list\` to see all tags.`,
    );
    return;
  }

  const result = await context.responders.interactionResponder.Reply(
    interaction,
    {
      content: RenderTagContent(tag.content, {
        userId: interaction.user.id,
        guildName: guild.name,
        channelId: interaction.channelId,
        memberCount: guild.memberCount,
      }),
      allowedMentions: TagAllowedMentions(interaction.user.id),
    },
  );

  if (result.success) {
    context.databases.serverDb.IncrementCustomTagUses(guild.id, tag.name);
  }
}

async function HandleCreate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  if (!(await RequireStaff(interaction, context))) {
    return;
  }

  const guild = RequireGuild(interaction);
  const name = ReadTagName(interaction);
  const nameError = ValidateTagName(name);
  if (nameError) {
    await ReplyEphemeral(
      interaction,
      context,
      "error",
      "Invalid Name",
      nameError,
    );
    return;
  }

  const { serverDb } = context.databases;
  if (serverDb.GetCustomTag(guild.id, name)) {
    await ReplyEphemeral(
      interaction,
      context,
      "warning",
      "Tag Exists",
      `\`${name}\` already exists. Use \`/tag edit\` to change it.`,
    );
    return;
  }

  if (serverDb.CountCustomTags(guild.id) >= TAG_LIMIT_PER_GUILD) {
    await ReplyEphemeral(
      interaction,
      context,
      "error",
      "Tag Limit Reached",
      `This server has the maximum of ${TAG_LIMIT_PER_GUILD} tags. Delete one first.`,
    );
    return;
  }

  await ShowContentModal(interaction, context, {
    title: `Create tag: ${name}`,
    onSubmit: async (modal, content) => {
      // Re-check: another moderator may have created it while the modal was open.
      if (serverDb.GetCustomTag(guild.id, name)) {
        await ReplyToModal(
          modal,
          EmbedFactory.CreateWarning({
            title: "Tag Exists",
            description: `\`${name}\` was created while you were typing. Use \`/tag edit\` instead.`,
          }),
        );
        return;
      }

      serverDb.CreateCustomTag({
        guild_id: guild.id,
        name,
        content,
        created_by: interaction.user.id,
      });

      const prefix = serverDb.GetGuildSettings(guild.id)?.tag_prefix ?? "!";
      const usage =
        prefix === TAG_PREFIX_DISABLED
          ? `\`/tag show name:${name}\``
          : `\`/tag show name:${name}\` or \`${prefix}${name}\``;
      await ReplyToModal(
        modal,
        EmbedFactory.CreateSuccess({
          title: "Tag Created",
          description: `Saved \`${name}\`. Use it with ${usage}.`,
        }),
      );
    },
  });
}

async function HandleEdit(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  if (!(await RequireStaff(interaction, context))) {
    return;
  }

  const guild = RequireGuild(interaction);
  const name = ReadTagName(interaction);
  const { serverDb } = context.databases;
  const tag = serverDb.GetCustomTag(guild.id, name);

  if (!tag) {
    await ReplyEphemeral(
      interaction,
      context,
      "warning",
      "Tag Not Found",
      `No tag named \`${name}\` exists.`,
    );
    return;
  }

  await ShowContentModal(interaction, context, {
    title: `Edit tag: ${name}`,
    existingContent: tag.content,
    onSubmit: async (modal, content) => {
      const updated = serverDb.UpdateCustomTagContent({
        guild_id: guild.id,
        name,
        content,
      });
      await ReplyToModal(
        modal,
        updated
          ? EmbedFactory.CreateSuccess({
              title: "Tag Updated",
              description: `Updated \`${name}\`.`,
            })
          : EmbedFactory.CreateWarning({
              title: "Tag Not Found",
              description: `\`${name}\` was deleted while you were editing.`,
            }),
      );
    },
  });
}

async function HandleDelete(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  if (!(await RequireStaff(interaction, context))) {
    return;
  }

  const guild = RequireGuild(interaction);
  const name = ReadTagName(interaction);
  const deleted = context.databases.serverDb.DeleteCustomTag(guild.id, name);

  if (!deleted) {
    await ReplyEphemeral(
      interaction,
      context,
      "warning",
      "Tag Not Found",
      `No tag named \`${name}\` exists.`,
    );
    return;
  }

  await ReplyEphemeral(
    interaction,
    context,
    "success",
    "Tag Deleted",
    `Deleted \`${name}\`.`,
  );
}

function BuildListPages(
  tags: Array<{ name: string; uses: number }>,
  prefix: string,
): PaginationPage[] {
  const usageHint =
    prefix === TAG_PREFIX_DISABLED
      ? "Use a tag with `/tag show`."
      : `Use a tag with \`/tag show\` or \`${prefix}name\` in chat.`;
  const pages: PaginationPage[] = [];

  for (let index = 0; index < tags.length; index += TAG_LIST_PAGE_SIZE) {
    const slice = tags.slice(index, index + TAG_LIST_PAGE_SIZE);
    const lines = slice.map(
      (tag) => `\`${tag.name}\` · ${tag.uses} use${tag.uses === 1 ? "" : "s"}`,
    );
    const embed = EmbedFactory.Create({
      title: `🏷️ Tags (${tags.length})`,
      description: `${usageHint}\n\n${lines.join("\n")}`,
    });
    pages.push({ embeds: [embed.toJSON()] });
  }

  return pages;
}

async function HandleList(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const { serverDb } = context.databases;
  const tags = serverDb.ListCustomTags(guild.id);

  if (tags.length === 0) {
    await ReplyEphemeral(
      interaction,
      context,
      "warning",
      "No Tags",
      "This server has no tags yet. Moderators can add one with `/tag create`.",
    );
    return;
  }

  const prefix = serverDb.GetGuildSettings(guild.id)?.tag_prefix ?? "!";
  const pages = BuildListPages(tags, prefix);

  if (pages.length === 1) {
    await context.responders.interactionResponder.Reply(interaction, {
      embeds: pages[0].embeds,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await context.responders.paginatedResponder.Send({
    interaction,
    pages,
    flags: MessageFlags.Ephemeral,
    ownerId: interaction.user.id,
    timeoutMs: 1000 * 60 * 3,
    idleTimeoutMs: 1000 * 60 * 2,
  });
}

async function HandleInfo(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  const guild = RequireGuild(interaction);
  const name = ReadTagName(interaction);
  const tag = context.databases.serverDb.GetCustomTag(guild.id, name);

  if (!tag) {
    await ReplyEphemeral(
      interaction,
      context,
      "warning",
      "Tag Not Found",
      `No tag named \`${name}\` exists.`,
    );
    return;
  }

  const embed = EmbedFactory.Create({
    title: `🏷️ ${tag.name}`,
    description:
      tag.content.length > 1000
        ? `${tag.content.slice(0, 1000)}…`
        : tag.content,
  });
  embed.addFields(
    { name: "Created by", value: `<@${tag.created_by}>`, inline: true },
    { name: "Uses", value: String(tag.uses), inline: true },
    {
      name: "Created",
      value: `<t:${Math.floor(tag.created_at / 1000)}:R>`,
      inline: true,
    },
    {
      name: "Last updated",
      value: `<t:${Math.floor(tag.updated_at / 1000)}:R>`,
      inline: true,
    },
  );

  await context.responders.interactionResponder.Reply(interaction, {
    embeds: [embed.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

async function HandlePrefix(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void> {
  if (!(await RequireStaff(interaction, context))) {
    return;
  }

  const guild = RequireGuild(interaction);
  const raw = interaction.options.getString("value", true).trim();
  const prefix =
    raw.toLowerCase() === TAG_PREFIX_DISABLED ? TAG_PREFIX_DISABLED : raw;
  const prefixError = ValidateTagPrefix(prefix);
  if (prefixError) {
    await ReplyEphemeral(
      interaction,
      context,
      "error",
      "Invalid Prefix",
      prefixError,
    );
    return;
  }

  context.databases.serverDb.UpsertGuildSettings({
    guild_id: guild.id,
    tag_prefix: prefix,
  });

  await ReplyEphemeral(
    interaction,
    context,
    "success",
    "Tag Prefix Updated",
    prefix === TAG_PREFIX_DISABLED
      ? "Chat triggers are off. Tags still work with `/tag show`."
      : `Members can now type \`${prefix}name\` to post a tag.`,
  );
}

async function AutocompleteTagName(
  interaction: AutocompleteInteraction,
  context: CommandContext,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.respond([]);
    return;
  }
  const query = String(interaction.options.getFocused());
  const names = context.databases.serverDb.SearchCustomTagNames(
    interaction.guildId,
    query,
    25,
  );
  await interaction.respond(names.map((name) => ({ name, value: name })));
}

export const TagCommand = CreateCommand({
  name: "tag",
  description: "Post or manage server tags (saved responses)",
  group: "utility",
  config: Config.utility(2),
  autocomplete: AutocompleteTagName,
  subcommands: [
    {
      name: "show",
      description: "Post a tag in this channel",
      options: (sub) =>
        sub.addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Tag name")
            .setRequired(true)
            .setMaxLength(TAG_NAME_MAX_LENGTH)
            .setAutocomplete(true),
        ),
      execute: HandleShow,
    },
    {
      name: "list",
      description: "List all tags in this server",
      execute: HandleList,
    },
    {
      name: "info",
      description: "Show a tag's content and stats",
      options: (sub) =>
        sub.addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Tag name")
            .setRequired(true)
            .setMaxLength(TAG_NAME_MAX_LENGTH)
            .setAutocomplete(true),
        ),
      execute: HandleInfo,
    },
    {
      name: "create",
      description: "Create a tag (moderator)",
      options: (sub) =>
        sub.addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Tag name (letters, numbers, - and _)")
            .setRequired(true)
            .setMaxLength(TAG_NAME_MAX_LENGTH),
        ),
      execute: HandleCreate,
    },
    {
      name: "edit",
      description: "Edit a tag's content (moderator)",
      options: (sub) =>
        sub.addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Tag name")
            .setRequired(true)
            .setMaxLength(TAG_NAME_MAX_LENGTH)
            .setAutocomplete(true),
        ),
      execute: HandleEdit,
    },
    {
      name: "delete",
      description: "Delete a tag (moderator)",
      options: (sub) =>
        sub.addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Tag name")
            .setRequired(true)
            .setMaxLength(TAG_NAME_MAX_LENGTH)
            .setAutocomplete(true),
        ),
      execute: HandleDelete,
    },
    {
      name: "prefix",
      description: "Set the chat prefix for tags, or 'off' (moderator)",
      options: (sub) =>
        sub.addStringOption((option) =>
          option
            .setName("value")
            .setDescription(
              `New prefix (1-${TAG_PREFIX_MAX_LENGTH} characters) or 'off'`,
            )
            .setRequired(true)
            .setMaxLength(TAG_PREFIX_MAX_LENGTH),
        ),
      execute: HandlePrefix,
    },
    {
      name: "about",
      description: "Learn how custom tags work",
      execute: (interaction, context) =>
        ReplyWithFeatureAbout(interaction, context, "tags"),
    },
  ],
});
